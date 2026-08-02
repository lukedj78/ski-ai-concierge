import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

/**
 * La connessione e' pigra di proposito: senza `DATABASE_URL` l'app deve
 * comunque partire e la chat deve restare viva. A fallire — con un messaggio
 * leggibile — e' il tool che prova a leggere il magazzino, non l'intero
 * processo all'avvio.
 */
let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!database) {
    client = postgres(requireDatabaseUrl(), { max: 1 });
    database = drizzle(client, { schema });
  }
  return database;
}

export { schema };
