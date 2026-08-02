import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Specialista della conversazione parlata. Prende una risposta gia' decisa e la rende dicibile ad alta voce: frasi brevi, niente markdown, numeri pronunciabili, una domanda alla volta. Emette anche il cue per l'avatar. Non conosce prezzi, magazzino ne' prenotazioni: delega a lui solo la forma, mai il contenuto.",
  // Un turno vocale deve tornare in fretta: qui serve il modello rapido, non
  // quello che ragiona. L'identificativo sta in una variabile d'ambiente.
  model: process.env.VOICE_AGENT_MODEL ?? "anthropic/claude-haiku-4.5",
});
