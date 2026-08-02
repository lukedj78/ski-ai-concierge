import { gateway } from "@ai-sdk/gateway";
import { experimental_transcribe as transcribe } from "ai";

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

const SPEECH_ENDPOINT = "https://ai-gateway.vercel.sh/v4/ai/speech-model";

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

/** Da `data:audio/webm;base64,...` (o base64 nudo) ai byte. */
export function decodeAudioDataUrl(input: string): {
  bytes: Uint8Array;
  mediaType: string;
} {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(input);
  const mediaType = match?.[1] ?? "audio/webm";
  const base64 = match?.[2] ?? input;
  return { bytes: Uint8Array.from(Buffer.from(base64, "base64")), mediaType };
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
        process.env.VOICE_STT_MODEL ?? "openai/whisper-1",
      ),
      audio: bytes,
    });

    return {
      text: result.text,
      language: result.language,
      durationInSeconds: result.durationInSeconds,
    };
  } catch (error) {
    throw new VoiceUnavailableError(
      "La trascrizione non e' riuscita: il modello audio potrebbe non essere abilitato su questo team.",
      error,
    );
  }
}

export async function synthesizeSpeech(text: string): Promise<{
  audioBase64: string;
  mediaType: string;
}> {
  const key = requireGatewayKey();

  const response = await fetch(SPEECH_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "ai-model-id": process.env.VOICE_TTS_MODEL ?? "openai/tts-1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice: process.env.VOICE_TTS_VOICE ?? "alloy",
      outputFormat: "mp3",
      language: "it",
    }),
  });

  if (!response.ok) {
    throw new VoiceUnavailableError(
      `La sintesi vocale ha risposto ${response.status}: il modello potrebbe non essere abilitato su questo team.`,
      await response.text().catch(() => undefined),
    );
  }

  const result = (await response.json()) as { audio?: string };
  if (!result.audio) {
    throw new VoiceUnavailableError(
      "La sintesi vocale non ha restituito audio.",
    );
  }

  return { audioBase64: result.audio, mediaType: "audio/mpeg" };
}
