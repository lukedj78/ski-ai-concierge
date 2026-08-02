import { defineAgent } from "eve";

/**
 * Il modello arriva da una variabile d'ambiente, in formato Gateway
 * `creator/modello`: cambiarlo non tocca una riga di codice applicativo, ed e'
 * l'unico posto del progetto dove compare un identificativo di modello per
 * l'agente principale.
 */
export default defineAgent({
  model: process.env.AGENT_MODEL ?? "anthropic/claude-sonnet-5",
});
