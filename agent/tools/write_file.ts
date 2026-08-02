import { disableTool } from "eve/tools";

/**
 * Disattivato di proposito.
 *
 * Il concierge di un negozio di sci non deve avere una shell, un filesystem
 * ne' l'accesso libero al web: sono strumenti predefiniti di eve, utili in
 * altri agenti e qui solo una superficie di rischio. In piu' erano un danno
 * concreto — il modello chiamava `bash` per rispondere a una domanda sui
 * noleggi e la sessione restava appesa per minuti su una sandbox che non
 * abbiamo configurato.
 *
 * Restano `load_skill` e i cinque tool del negozio.
 */
export default disableTool();
