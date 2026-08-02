/**
 * I modelli della voce, definiti dove vive la voce: nel sub-agente.
 *
 * Sono tutti identificativi del **Vercel AI Gateway** in formato
 * `creator/modello`. Il Gateway e' l'unica strada verso i modelli: non esiste
 * nel progetto una chiamata diretta a un provider.
 *
 * Chi li usa:
 *   - `lib/speech.ts`            trascrizione e sintesi (via batch)
 *   - `app/api/realtime/token`   sessione vocale realtime
 *
 * Nessuno di questi identificativi e' scritto nel frontend: la rotta del
 * gettone comunica al browser quale modello usare.
 */
export const voiceModels = {
  /** Speech-to-speech: un salto solo, latenza da conversazione. */
  realtime: process.env.REALTIME_MODEL ?? "xai/grok-voice-think-fast-2.0",
  realtimeVoice: process.env.REALTIME_VOICE ?? "alloy",

  /** Via batch: audio → testo, testo → audio. */
  transcription: process.env.VOICE_STT_MODEL ?? "openai/whisper-1",
  speech: process.env.VOICE_TTS_MODEL ?? "openai/tts-1",
  speechVoice: process.env.VOICE_TTS_VOICE ?? "alloy",
} as const;
