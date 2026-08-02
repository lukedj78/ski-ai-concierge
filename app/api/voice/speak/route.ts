import { synthesizeSpeech, VoiceUnavailableError } from "@/lib/speech";

/** Oltre questa lunghezza la sintesi diventa lenta e la risposta illeggibile. */
const MAX_SPEAK_CHARS = 1200;

/**
 * Testo → audio. Riceve la risposta gia' decisa dall'agente e la restituisce
 * parlata. Non decide cosa dire: decide solo come suona.
 */
export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "corpo_non_valido", message: "Serve un corpo JSON." },
      { status: 400 },
    );
  }

  const text = body.text?.trim();
  if (!text) {
    return Response.json(
      { error: "testo_mancante", message: "Serve il campo `text`." },
      { status: 400 },
    );
  }

  try {
    const result = await synthesizeSpeech(text.slice(0, MAX_SPEAK_CHARS));
    return Response.json({
      audio: result.audioBase64,
      mediaType: result.mediaType,
      truncated: text.length > MAX_SPEAK_CHARS,
    });
  } catch (error) {
    if (error instanceof VoiceUnavailableError) {
      return Response.json(
        { error: "voce_non_disponibile", message: error.message },
        { status: 503 },
      );
    }
    throw error;
  }
}
