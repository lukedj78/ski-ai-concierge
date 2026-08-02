import { defineChannel, POST } from "eve/channels";
import {
  synthesizeSpeech,
  transcribeAudio,
  VoiceUnavailableError,
} from "../lib/speech";

/**
 * Il canale vocale.
 *
 * Fa il trasporto e i due passi deterministici — trascrivere l'audio in
 * ingresso, sintetizzare la risposta — e lascia all'agente tutto il resto.
 *
 * Perche' trascrizione e sintesi stanno qui e non sono tool richiamabili dal
 * modello: far passare audio base64 nel contesto di un LLM costa molto e non
 * serve a niente. Il modello non deve "decidere" di trascrivere, deve ricevere
 * testo. Il sub-agente `voice` si occupa di come si parla, non di come si
 * codifica l'audio.
 */

const MAX_TURN_MS = 90_000;

type TurnBody = {
  audio?: string;
  token?: string;
};

/**
 * Lo stato del canale. Va passato esplicitamente a `POST<VoiceState>`: gli
 * helper di rotta sono chiamati fuori dal literal di `defineChannel`, quindi
 * TypeScript non puo' dedurlo dalla proprieta' `state` accanto.
 */
type VoiceState = { mode: "voice" | "text" };

export default defineChannel({
  cors: true,
  // Lo stato del canale marca i turni che arrivano dal microfono: l'agente lo
  // legge per delegare la resa parlata al sub-agente `voice`.
  state: {
    mode: "voice",
  } satisfies VoiceState as VoiceState,
  metadata(state) {
    return { mode: state.mode };
  },
  routes: [
    POST<VoiceState>("/turn", async (req, { send }) => {
      let body: TurnBody;
      try {
        body = (await req.json()) as TurnBody;
      } catch {
        return Response.json(
          { error: "corpo_non_valido", message: "Serve un corpo JSON." },
          { status: 400 },
        );
      }

      if (!body.audio) {
        return Response.json(
          {
            error: "audio_mancante",
            message: "Serve il campo `audio` come data URL base64.",
          },
          { status: 400 },
        );
      }

      // 1. L'audio diventa testo.
      let transcript: string;
      try {
        const result = await transcribeAudio(body.audio);
        transcript = result.text.trim();
      } catch (error) {
        if (error instanceof VoiceUnavailableError) {
          return Response.json(
            { error: "voce_non_disponibile", message: error.message },
            { status: 503 },
          );
        }
        throw error;
      }

      if (!transcript) {
        return Response.json(
          {
            error: "audio_vuoto",
            message: "Non ho sentito niente. Riprova a parlare piu' vicino.",
          },
          { status: 422 },
        );
      }

      // 2. Il testo entra nella sessione dell'agente, marcato come turno
      //    parlato: e' questo che fa delegare la resa al sub-agente `voice`.
      const session = await send(transcript, {
        auth: null,
        continuationToken: body.token ?? crypto.randomUUID(),
        state: { mode: "voice" },
        title: "Conversazione a voce",
      });

      // 3. Si aspetta la fine del turno raccogliendo il testo dell'assistente.
      const stream = await session.getEventStream();
      const reader = stream.getReader();
      const parts: string[] = [];
      let failure: string | undefined;

      const deadline = setTimeout(() => reader.cancel(), MAX_TURN_MS);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          if (value.type === "message.completed" && value.data.message) {
            parts.push(value.data.message);
          }
          if (value.type === "turn.failed") {
            failure = value.data.message;
            break;
          }
          if (value.type === "turn.completed") break;
        }
      } finally {
        clearTimeout(deadline);
        reader.releaseLock();
      }

      if (failure) {
        return Response.json(
          { error: "turno_fallito", message: failure },
          { status: 502 },
        );
      }

      const text = parts.join("\n\n").trim();
      if (!text) {
        return Response.json(
          {
            error: "nessuna_risposta",
            message: "Il turno si e' chiuso senza una risposta da dire.",
            transcript,
            token: session.continuationToken,
          },
          { status: 502 },
        );
      }

      // 4. La risposta torna anche come audio. Se la sintesi non e'
      //    disponibile il testo parte lo stesso: la conversazione continua,
      //    solo senza voce.
      let audio: { audioBase64: string; mediaType: string } | undefined;
      let voiceError: string | undefined;
      try {
        audio = await synthesizeSpeech(text);
      } catch (error) {
        if (error instanceof VoiceUnavailableError) {
          voiceError = error.message;
        } else {
          throw error;
        }
      }

      return Response.json({
        transcript,
        text,
        audio: audio?.audioBase64 ?? null,
        audioMediaType: audio?.mediaType ?? null,
        voiceError: voiceError ?? null,
        token: session.continuationToken,
        sessionId: session.id,
      });
    }),
  ],
});
