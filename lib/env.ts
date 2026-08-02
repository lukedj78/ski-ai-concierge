import { z } from "zod";

/**
 * Le variabili d'ambiente, validate all'avvio del modulo.
 *
 * Il punto e' fallire subito e con un messaggio leggibile, invece di scoprire
 * un `DATABASE_URL` mancante alla prima query in produzione.
 *
 * I model id vivono qui e da nessun'altra parte: cambiare modello e' cambiare
 * una variabile, non una riga di codice applicativo.
 */
const schema = z.object({
  // Database — richiesto dai tool, non dall'interfaccia.
  DATABASE_URL: z.string().url().optional(),

  // Vercel AI Gateway: una chiave per modelli di testo, trascrizione e voce.
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),

  // Modello dell'agente principale, in formato Gateway `creator/modello`.
  AGENT_MODEL: z.string().min(1).default("anthropic/claude-sonnet-5"),

  // I modelli della voce non stanno qui: li dichiara
  // agent/lib/voice-models.ts, che legge VOICE_STT_MODEL, REALTIME_MODEL e
  // REALTIME_VOICE.

  // Embedding per la ricerca semantica sulla documentazione del negozio.
  EMBEDDING_MODEL: z.string().min(1).default("openai/text-embedding-3-small"),
});

/**
 * Una variabile lasciata vuota in `.env.local` arriva come stringa vuota, non
 * come assente. Senza questa normalizzazione `AI_GATEWAY_API_KEY=` fa fallire
 * la validazione e l'app non parte — che e' esattamente il contrario di quello
 * che serve a chi sta ancora configurando.
 */
const provided = Object.fromEntries(
  Object.entries(process.env).filter(
    ([, value]) => value !== undefined && value.trim().length > 0,
  ),
);

const parsed = schema.safeParse(provided);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Variabili d'ambiente non valide:\n${details}\n\nCopia .env.example in .env.local e completa i valori.`,
  );
}

export const env = parsed.data;

/**
 * `DATABASE_URL` e' opzionale a livello di schema perche' l'interfaccia deve
 * partire anche senza database: e' la chat a restare viva, sono i tool a
 * fallire con un messaggio esplicito. Chi ha bisogno della connessione usa
 * questa funzione invece di leggere `env.DATABASE_URL` alla cieca.
 */
export function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL non e' configurata: i dati di magazzino e listino non sono raggiungibili. Vedi docs/SETUP.md.",
    );
  }
  return env.DATABASE_URL;
}
