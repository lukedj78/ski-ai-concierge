# Gli strumenti del concierge

Cinque tool, uno per cosa che il negozio sa fare:

| File | Cosa fa |
|---|---|
| `get_equipment_availability.ts` | cosa e' libero, per categoria, taglia e date |
| `calculate_rental_price.ts` | quanto costa, con fasce, cauzione e assicurazione |
| `recommend_equipment.ts` | dal profilo del cliente al setup consigliato |
| `create_booking.ts` | crea la prenotazione — l'unico che scrive |
| `search_knowledge.ts` | cerca nelle policy e nelle informazioni del negozio |

Sono l'**unico** punto del progetto che parla con il database.

## Gli otto file che contengono solo `disableTool()`

`bash.ts`, `read_file.ts`, `write_file.ts`, `glob.ts`, `grep.ts`,
`web_fetch.ts`, `web_search.ts`, `todo.ts`.

**Non li abbiamo aggiunti noi: erano gia' li'.** Ogni agente eve nasce con un
insieme di strumenti predefiniti — il *default harness* — pensato per agenti
che scrivono codice o fanno operazioni: una shell, i file, il web. La doc di
eve lo dice a chiare lettere:

> Review these built-in tools before production use. Disable, wrap, restrict,
> or require approval for any tool that can access the filesystem, network,
> shell, or sensitive data.

Il nostro e' un altro prodotto: un concierge di un negozio di sci non deve
eseguire comandi, leggere file ne' navigare il web. Quindi si disattivano.

In eve l'identita' viene dal percorso — `agent/tools/bash.ts` **e'** il tool
`bash` — quindi anche spegnerlo passa dal file: si esporta il sentinella
`disableTool()`, e il modello quello strumento non lo vede proprio. Non esiste
un elenco di configurazione altrove: sarebbe estraneo al modo in cui eve
funziona.

## Perche' non lasciarli e sperare che il modello scelga bene

Non e' una questione di fiducia nel modello, sono tre fatti:

1. **`bash` non poteva funzionare comunque.** Gira in una sandbox che questo
   progetto non configura: la chiamata restava appesa per minuti. Non era una
   scelta discutibile, era una strada senza uscita.
2. **Ogni strumento in lista costa attenzione.** Con nove voci il modello
   sceglie peggio e piu' lentamente che con sei, e in una conversazione a voce
   la lentezza si sente.
3. **E' superficie di rischio.** Un agente rivolto al pubblico con una shell
   aperta e' una domanda che non vuoi ricevere.

## Come si rimette uno strumento

Si cancella il file. Il predefinito torna da solo.
