<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ski-ai-concierge

Assistente conversazionale con avatar 3D per un negozio di noleggio e vendita
di attrezzatura sciistica. Next.js 16 davanti, un agente eve dietro.

## I tre confini

Sono la ragione per cui questo progetto e' strutturato cosi'. Non sono
preferenze: se ne rompi uno, il progetto smette di essere quello che e'.

1. **Il frontend non conosce i modelli AI.** Nessun file sotto `app/` o
   `components/` importa `ai` o `@ai-sdk/*`, e nessun identificativo di modello
   compare li'. I model id vivono in `lib/env.ts` e in `agent/`, presi da
   variabili d'ambiente.
2. **Il frontend non tocca i dati.** `db/` e' importato **solo** da
   `agent/tools/*`. Se un componente React importa `db/`, il confine e' rotto.
3. **eve e' l'unico orchestratore agentico.** Non esiste un secondo posto dove
   si decide quale modello chiamare o quale tool eseguire. Le route handler in
   `app/api/` fanno conversioni di formato (audio ↔ testo), non orchestrazione.

## La lingua del codice

**Identificatori, nomi di file e rotte in inglese. Commenti e testi
dell'interfaccia in italiano.**

Un progetto meta' in una lingua e meta' nell'altra costringe a indovinare, a
ogni riga, in che lingua sara' scritta la prossima cosa.

- funzioni, variabili, tipi, componenti, costanti → **inglese**
- nomi di file e di cartelle → **inglese**
- rotte → **inglese**
- commenti, messaggi di commit, documentazione → **italiano**
- testi che legge il cliente → **italiano**

I termini del dominio seguono lo schema del database, che e' gia' inglese:
`equipment`, `booking`, `rental`, `product`, `knowledge_document`.

I nomi dei tool eve sono in `snake_case`, perche' in eve **il nome del file
diventa il nome del tool** e quella e' la convenzione della doc.

## La documentazione di eve sta online

**La fonte di verita' e' <https://eve.dev/docs>.** eve e' in beta e cambia in
fretta: la copia in `node_modules/eve/docs/` e' la fotografia di una versione e
diverge. Prima di scrivere codice eve, leggi la pagina che ti serve.

Due scorciatoie utili: `https://eve.dev/sitemap.md` elenca tutte le pagine, e
aggiungere `.md` all'URL di una pagina ne restituisce il markdown grezzo.

## Node 24, non meno

eve richiede **Node >= 24**. Il progetto lo dichiara in `.nvmrc` e in
`engines`, ma la shell non se ne accorge da sola: se hai un Node di sistema
piu' vecchio nel PATH, `pnpm dev` muore con

```
[eve:dev] eve requires Node.js >=24. You are running v22.x
```

Prima di lavorare, nella cartella del progetto:

```bash
nvm use
```

## Sviluppo locale — due processi, non uno

`pnpm dev` avvia Next; l'agente eve e' un **processo separato**
(`pnpm dev:agent`) che **sopravvive ai riavvii di Next**.

eve esegue uno **snapshot** del progetto scattato al proprio avvio
(`.eve/dev-runtime/snapshots/<id>/source`). Se modifichi qualcosa sotto
`agent/` — un tool, una skill, le istruzioni — **riavviare Next non basta**:
eve continua a eseguire la fotografia precedente.

Per vedere cosa sta effettivamente eseguendo:

```bash
curl -s http://127.0.0.1:2000/eve/v1/info | python3 -c "import json,sys; print(json.load(sys.stdin)['agent']['appRoot'])"
```

Anche le variabili d'ambiente si leggono **all'avvio**: dopo aver modificato
`.env.local`, riavvia entrambi i processi.

## Le rotte dei canali custom non passano da Next

`withEve` scrive **un solo rewrite**, `<prefisso>/eve/v1/:path+`, in sviluppo
come su Vercel. Le rotte di un canale custom **non sono raggiungibili
dall'origine di Next**: servono ai webhook in ingresso dalle piattaforme
(Slack, GitHub, Twilio), che colpiscono il servizio eve direttamente.

Per una UI web la doc di eve indica il canale `eve` + `useEveAgent`, ed e'
quello che usiamo. Se serve un endpoint HTTP chiamato dal browser, e' una route
handler di Next, non un canale.

## Struttura

```
app/            la schermata unica, il layout, le due rotte vocali
components/     ui/ (solo shadcn) · avatar/ · chat/ · voice/ · theme/ · shared/
agent/          agent.ts · instructions.md · tools/ · skills/ · subagents/voice/
db/             schema, connessione, migrazioni, seed
lib/            env.ts (variabili validate) · speech.ts (STT/TTS) · utils.ts
evals/          i controlli sull'agente
docs/           architettura, agenti, roadmap, setup
```

Convenzione dei componenti: si parte sempre da `app/<rotta>/_components/`; si
promuove a `components/shared/<dominio>/` solo al terzo utilizzo.

## UI

**shadcn/ui e' l'unica libreria di componenti**, su primitive **Base UI**
(`components.json` ha `style: "base-nova"` — e' quello, non il flag `-b`, a
decidere quale variante scarica il CLI). Icone **hugeicons**
(`@hugeicons/react` + `@hugeicons/core-free-icons`).

I token vengono da `.workflow/DESIGN.md` attraverso `registry-item.json`. Il
blocco `.dark` in `app/globals.css` e' **scritto a mano**: la derivazione
automatica produceva superfici nero puro e testo nero su blu.
