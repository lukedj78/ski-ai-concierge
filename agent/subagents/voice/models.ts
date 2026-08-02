/**
 * I modelli della voce, definiti dove vive la voce: nel sub-agente.
 *
 * Sono tutti identificativi del **Vercel AI Gateway** in formato
 * `creator/modello`. Il Gateway e' l'unica strada verso i modelli: non esiste
 * nel progetto una chiamata diretta a un provider.
 *
 * Chi li usa: `app/api/realtime/token` e la pagina del concierge, che li riceve
 * come props. Il componente client non sceglie mai un modello.
 *
 * Nessuno di questi identificativi e' scritto nel frontend: la rotta del
 * gettone comunica al browser quale modello usare.
 */
export const voiceModels = {
  /**
   * Speech-to-speech: un salto solo, latenza da conversazione.
   *
   * Il modello OpenAI e' il predefinito perche' regge la trascrizione, che
   * serve a scrivere in chat sia quello che dice il cliente sia quello che
   * risponde l'avatar. La doc del Gateway e' esplicita sui Grok Voice:
   * "supports speech-to-speech only, so it does not handle transcription or
   * translation" — con quelli la conversazione funziona, ma la chat resta
   * muta.
   */
  realtime: process.env.REALTIME_MODEL ?? "openai/gpt-realtime-2.1",
  realtimeVoice: process.env.REALTIME_VOICE ?? "alloy",

  /**
   * Trascrizione: serve alla sessione realtime per scrivere in chat sia quello
   * che dici tu sia quello che risponde l'avatar.
   */
  transcription: process.env.VOICE_STT_MODEL ?? "openai/whisper-1",
} as const;
