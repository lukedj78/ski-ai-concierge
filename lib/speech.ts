import { gateway } from "@ai-sdk/gateway";
import { generateSpeech, experimental_transcribe as transcribe } from "ai";
import { voiceModels } from "@/agent/subagents/voice/models";

/**
 * Voce: trascrizione e sintesi, entrambe attraverso il Vercel AI Gateway.
 *
 * Qui vivono gli unici identificativi di modello della parte vocale, presi da
 * variabili d'ambiente. Cambiare provider — da OpenAI a xAI, o a qualunque
 * altro modello audio del catalogo — significa cambiare una variabile, non
 * questo file.
 *
 * **Perche' sta in `lib/` e non dentro `agent/`.** Il primo tentativo e' stato
 * un canale eve custom con le rotte `/voice/*`. Non funziona: `withEve` scrive
 * un solo rewrite, `<prefisso>/eve/v1/:path+`, in sviluppo come su Vercel. Le
 * rotte dei canali custom non sono mai esposte attraverso l'origine di Next —
 * servono ai webhook in ingresso dalle piattaforme, che colpiscono il servizio
 * eve direttamente. Per una UI web la doc di eve indica il canale `eve` +
 * `useEveAgent`, ed e' quello che la chat usa.
 *
 * Trascrizione e sintesi non sono orchestrazione agentica: sono conversioni di
 * formato. Vivono in due route handler di Next che chiamano il Gateway lato
 * server. Il frontend continua a non sapere quale modello trascrive, e eve
 * resta l'unico orchestratore della conversazione. La parte agentica della
 * voce — come si parla — resta il sub-agente `agent/subagents/voice/`.
 *
 * Perche' il TTS passa dall'endpoint REST e non da `gateway.speechModel()`:
 * la doc dice che il supporto speech nel provider Gateway e' disponibile
 * "on the canary releases of the AI SDK". Una POC non si costruisce su una
 * canary; l'endpoint REST e' documentato, stabile e fa la stessa cosa.
 */

/**
 * Errore di dominio: i modelli audio del Gateway sono in beta con rollout
 * graduale e possono non essere nel catalogo di un team. Chi chiama lo
 * traduce in un 503 e l'interfaccia degrada a chat testuale.
 */
export class VoiceUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "VoiceUnavailableError";
    this.cause = cause;
  }
}

function requireGatewayKey(): string {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    throw new VoiceUnavailableError(
      "AI_GATEWAY_API_KEY non e' configurata: la voce non e' disponibile.",
    );
  }
  return key;
}

/**
 * Da data URL (o base64 nudo) ai byte.
 *
 * Attenzione ai parametri del media type: Chrome produce
 * `data:audio/webm;codecs=opus;base64,...`, Safari `data:audio/mp4;base64,...`.
 * Una regex che pretende `;base64,` subito dopo il tipo fallisce sul primo
 * caso — e il ripiego "allora e' base64 nudo" finisce per decodificare anche
 * il prefisso, producendo byte spazzatura e un errore fuorviante del
 * provider. Qui si taglia sulla prima virgola, che nei data URL separa sempre
 * l'intestazione dal contenuto.
 */
export function decodeAudioDataUrl(input: string): {
  bytes: Uint8Array;
  mediaType: string;
} {
  let mediaType = "audio/webm";
  let base64 = input;

  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma === -1) {
      throw new VoiceUnavailableError("Data URL malformato: manca la virgola.");
    }
    const header = input.slice(5, comma);
    base64 = input.slice(comma + 1);
    // `audio/webm;codecs=opus;base64` → `audio/webm`
    const declared = header.split(";")[0]?.trim();
    if (declared) mediaType = declared;
  }

  return {
    bytes: Uint8Array.from(Buffer.from(base64, "base64")),
    mediaType,
  };
}

export async function transcribeAudio(audioDataUrl: string): Promise<{
  text: string;
  language?: string;
  durationInSeconds?: number;
}> {
  requireGatewayKey();
  const { bytes } = decodeAudioDataUrl(audioDataUrl);

  try {
    const result = await transcribe({
      model: gateway.transcriptionModel(
        voiceModels.transcription,
      ),
      audio: bytes,
    });

    return {
      text: result.text,
      language: result.language,
      durationInSeconds: result.durationInSeconds,
    };
  } catch (error) {
    // La causa vera va sempre nei log del server: un messaggio generico
    // trasforma un problema diagnosticabile in un mistero.
    console.error("[voce] trascrizione fallita", error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new VoiceUnavailableError(
      `La trascrizione non e' riuscita: ${detail}`,
      error,
    );
  }
}

export async function synthesizeSpeech(text: string): Promise<{
  audioBase64: string;
  mediaType: string;
}> {
  requireGatewayKey();

  try {
    const result = await generateSpeech({
      model: gateway.speechModel(voiceModels.speech),
      text,
      voice: voiceModels.speechVoice,
      outputFormat: "mp3",
      language: "it",
    });

    // I parametri non supportati dal modello arrivano come warning invece di
    // far fallire la chiamata: vale la pena vederli nei log.
    for (const warning of result.warnings) {
      console.warn("[voce] sintesi, avviso dal provider:", warning);
    }

    return {
      audioBase64: result.audio.base64,
      mediaType: result.audio.mediaType,
    };
  } catch (error) {
    console.error("[voce] sintesi fallita", error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new VoiceUnavailableError(
      `La sintesi vocale non e' riuscita: ${detail}`,
      error,
    );
  }
}
