import type { MessageStreamEvent } from "eve/client";

/**
 * Gli stati dell'avatar. Sono quattro e non cambiano: sono il contratto fra il
 * mondo di eve e la scena 3D.
 */
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Questo file e' l'unico posto del progetto dove un evento di eve diventa uno
 * stato d'avatar. `Avatar3D` riceve `{ state, amplitude }` e non sa che eve
 * esista; l'agente non sa che esista un avatar.
 *
 * La regola e' "vince l'ultimo evento decisivo": si scorre lo stream a
 * ritroso e ci si ferma al primo evento che dice qualcosa sullo stato.
 */
export function avatarStateFromEvents(
  events: readonly MessageStreamEvent[],
  options: { listening?: boolean; speaking?: boolean } = {},
): AvatarState {
  // Il microfono aperto batte tutto: sta parlando l'utente.
  if (options.listening) return "listening";

  // L'audio in riproduzione viene subito dopo, e batte lo stream.
  //
  // Serve perche' i due tempi non coincidono: il testo arriva in streaming
  // durante il turno, l'audio arriva quando il turno e' gia' chiuso. Senza
  // questa riga lo stato sarebbe tornato "idle" proprio mentre la voce parla,
  // e la bocca resterebbe ferma per tutta la risposta.
  if (options.speaking) return "speaking";

  for (let i = events.length - 1; i >= 0; i -= 1) {
    switch (events[i]?.type) {
      case "turn.completed":
      case "turn.failed":
      case "turn.cancelled":
      case "session.waiting":
      case "session.completed":
        return "idle";
      case "message.appended":
      case "message.completed":
        return "speaking";
      case "turn.started":
      case "actions.requested":
      case "action.result":
      case "subagent.called":
      case "reasoning.appended":
      case "step.started":
        return "thinking";
      default:
        break;
    }
  }

  return "idle";
}

/** Cosa scrivere accanto al microfono. Lo stato si legge, non si indovina. */
export const AVATAR_STATE_LABEL: Record<AvatarState, string> = {
  idle: "pronto",
  listening: "ti ascolto",
  thinking: "sto controllando",
  speaking: "rispondo",
};
