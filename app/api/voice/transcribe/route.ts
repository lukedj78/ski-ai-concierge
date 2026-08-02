import { transcribeAudio, VoiceUnavailableError } from "@/lib/speech";

/**
 * Audio → testo. Il testo poi entra nella conversazione dalla porta normale,
 * cioe' `useEveAgent().send()`: una conversazione sola, una sessione sola.
 *
 * Qui non c'e' orchestrazione: nessuna scelta di tool, nessuna istruzione,
 * nessuna decisione. Solo una conversione di formato che il browser non puo'
 * fare da solo.
 */
export async function POST(request: Request) {
  let body: { audio?: string };
  try {
    body = await request.json();
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

  try {
    const result = await transcribeAudio(body.audio);
    const text = result.text.trim();

    if (!text) {
      return Response.json(
        {
          error: "audio_vuoto",
          message: "Non ho sentito niente. Riprova a parlare piu' vicino.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      text,
      language: result.language ?? null,
      durationInSeconds: result.durationInSeconds ?? null,
    });
  } catch (error) {
    if (error instanceof VoiceUnavailableError) {
      // I modelli audio del Gateway sono in beta con rollout graduale: se il
      // team non li ha, l'interfaccia degrada a chat testuale invece di
      // rompersi.
      return Response.json(
        { error: "voce_non_disponibile", message: error.message },
        { status: 503 },
      );
    }
    throw error;
  }
}
