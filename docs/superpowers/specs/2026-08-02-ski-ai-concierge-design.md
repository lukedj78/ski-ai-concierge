# Ski AI Concierge — design

**Data:** 2026-08-02 · **Stato:** approvato in brainstorming, da eseguire

## Cosa costruiamo

Una POC SaaS: un assistente conversazionale con avatar 3D per un negozio di
noleggio e vendita di attrezzatura sciistica. Tutto web, deployabile su Vercel.

Il cliente apre la pagina, vede un maestro di sci animato, gli parla o gli
scrive, e l'assistente risponde consultando inventario, listino e policy del
negozio — arrivando a creare una prenotazione.

L'obiettivo non è la demo: è una base che possa diventare prodotto. Quindi i
confini fra i moduli contano più delle funzionalità.

## I confini, che sono la parte importante

Tre regole che il codice deve rendere impossibili da violare, non solo
scoraggiare:

1. **Il frontend non conosce i modelli AI.** Nessun componente importa `ai` o
   `@ai-sdk/*`, nessun model id compare sotto `app/` o `components/`. Il
   frontend parla con eve e basta.
2. **Il frontend non tocca dati.** Nessuna query, nessun tool, nessuna chiamata
   a servizi esterni. Solo `useEveAgent()` e lo stream di eventi.
3. **eve è l'unico orchestratore.** Non esiste un secondo posto dove si decide
   quale modello chiamare o quale tool eseguire. Niente logica agentica nelle
   route Next.

Corollario pratico: `db/` è importato **solo** da `agent/tools/*`. Se un giorno
un componente React importa `db/`, il confine è rotto.

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                              │
│  ChatPanel ──useEveAgent()──┐        VoiceButton             │
│  MessageList                │           │                    │
│  ChatInput                  │           │ audio (webm)       │
│                             │           │                    │
│  AvatarController ◄─ eventi ┘           │                    │
│       │  { state, amplitude }           │                    │
│  Avatar3D (R3F + VRM)                   │                    │
└─────────────┬───────────────────────────┴────────────────────┘
              │ /eve/v1/**            │ /voice/turn (rewrite)
┌─────────────▼───────────────────────▼────────────────────────┐
│  eve  (agent/)                                               │
│                                                              │
│  agent.ts ── model da env ──► Vercel AI Gateway              │
│  instructions.md                                             │
│                                                              │
│  skills/   rental · sales · advisor · faq   (load_skill)     │
│  tools/    get_equipment_availability · calculate_rental_price│
│            create_booking · recommend_equipment ·            │
│            search_knowledge                                  │
│  subagents/voice/   transcribe_audio · synthesize_speech     │
│  channels/voice.ts  POST /voice/turn                         │
│  lib/speech.ts      STT/TTS via Gateway, model id da env     │
└─────────────┬────────────────────────────────────────────────┘
              │  solo i tool arrivano qui
┌─────────────▼────────────────────────────────────────────────┐
│  db/  Drizzle + Neon Postgres (+ pgvector)                   │
└──────────────────────────────────────────────────────────────┘
```

### Perché single package e non monorepo

`agent/` in root è il layout nativo di eve (`/docs/reference/project-layout`) e
`withEve()` lo monta su `/eve/v1/**` same-origin. Un `pnpm install`, un deploy
Vercel, nessun workspace da orchestrare. Un monorepo servirebbe se ci fosse un
secondo frontend; non c'è.

## Struttura del repository

```
ski-ai-concierge/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  la schermata unica: header · avatar · chat · barra voce
│   ├── globals.css
│   └── api/                      (vuota nella POC: eve monta le sue rotte da solo)
├── components/
│   ├── ui/                       SOLO componenti shadcn generati dalla CLI
│   ├── avatar/
│   │   ├── Avatar3D.tsx          scena R3F, carica il VRM o il placeholder
│   │   ├── AvatarCanvas.tsx      <Canvas>, luci, camera a mezza figura
│   │   ├── AvatarController.tsx  l'unico ponte: eventi eve → stato avatar
│   │   ├── AvatarState.ts        tipo AvatarState + mappatura evento → stato
│   │   └── animations/
│   │       ├── idle.ts           respiro, micro-movimenti della testa
│   │       └── lipSync.ts        ampiezza audio → expression VRM (aa/ih/ou/ee/oh)
│   ├── chat/
│   │   ├── ChatPanel.tsx         useEveAgent(), orchestrazione della conversazione
│   │   ├── MessageList.tsx
│   │   └── ChatInput.tsx
│   └── voice/
│       ├── VoiceButton.tsx       cattura microfono, POST a /voice/turn
│       └── VoiceStatus.tsx       stato agente leggibile
├── agent/
│   ├── agent.ts
│   ├── instructions.md
│   ├── skills/{rental,sales,advisor,faq}/SKILL.md
│   ├── tools/*.ts
│   ├── subagents/voice/{agent.ts,instructions.md,tools/*.ts}
│   ├── channels/voice.ts
│   └── lib/speech.ts
├── db/
│   ├── schema.ts
│   ├── index.ts
│   ├── seed.ts
│   └── migrations/
├── evals/
├── docs/{ARCHITECTURE,AGENTS,ROADMAP,SETUP}.md
├── public/avatar/                dove cade il .vrm
├── next.config.ts                withEve + rewrite /voice/*
├── biome.json
└── README.md
```

## Frontend

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4,
shadcn/ui su primitive Radix, icone lucide, Biome, pnpm.

**Layout desktop** — una sola schermata, tre fasce:

```
┌──────────────────────────────────────────────────────┐
│  Header: nome negozio · badge stato connessione      │
├────────────────────────┬─────────────────────────────┤
│                        │                             │
│   Avatar 3D            │   Chat                      │
│   maestro di sci       │   conversazione streaming   │
│   (Card, ~40%)         │   (Card + ScrollArea, ~60%) │
│                        │                             │
├────────────────────────┴─────────────────────────────┤
│  VoiceButton (microfono) · VoiceStatus               │
└──────────────────────────────────────────────────────┘
```

Sotto `md` le due colonne si impilano: avatar sopra (altezza ridotta), chat
sotto, barra voce sticky in fondo.

Componenti shadcn usati: `button`, `card`, `input`, `scroll-area`, `avatar`,
`badge`, `separator`, `skeleton`, `sonner`. Nessuna altra libreria UI.

### Lo stato dell'avatar

`AvatarState.ts` è l'unico posto dove uno stream di eve diventa uno stato
d'avatar:

```ts
export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
```

| Sorgente | Stato |
|---|---|
| microfono aperto nel client | `listening` |
| `turn.started`, `actions.requested`, `subagent.called` | `thinking` |
| primo `message.appended` del turno | `speaking` |
| `turn.completed`, `session.waiting`, `turn.failed` | `idle` |

`Avatar3D` riceve `{ state, amplitude }` e nient'altro. Non sa che esiste eve.

### L'avatar 3D

React Three Fiber + Three.js + `@pixiv/three-vrm`. Mezza figura ottenuta con
inquadratura (camera sul busto), non tagliando la mesh.

I VRM espongono expression standardizzate: i visemi `aa/ih/ou/ee/oh` e le
espressioni facciali `happy/angry/sad/relaxed/surprised`. Il lip sync è quindi
reale: `lipSync.ts` legge l'ampiezza RMS dell'audio TTS in riproduzione
(`AnalyserNode` della Web Audio API) e la mappa sul viseme aperto.

**Asset:** non mettiamo nel repo un VRM di terzi per non trascinarci una
licenza. `Avatar3D` carica `NEXT_PUBLIC_AVATAR_URL` (default
`/avatar/instructor.vrm`); se il file non c'è, fa fallback su un **placeholder
procedurale** (forme primitive animate con gli stessi quattro stati). Il repo
parte con `pnpm dev` anche a mani vuote; `SETUP.md` spiega dove prendere o
generare un VRM e dove metterlo.

## L'agente eve

### Configurazione del modello

```ts
// agent/agent.ts
import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.AGENT_MODEL ?? "anthropic/claude-sonnet-5",
});
```

Formato Gateway `creator/modello`: instrada sul Vercel AI Gateway con
`AI_GATEWAY_API_KEY`. Cambiare modello è cambiare una variabile d'ambiente —
nessuna riga di codice applicativo.

### instructions.md

Persona: addetto esperto di un negozio di noleggio/vendita sci. Parla italiano,
tono cordiale e concreto. Regole non negoziabili:

- Prezzi, disponibilità e policy **solo** da tool. Mai stimati, mai ricordati.
- Prima di proporre attrezzatura chiede livello, altezza, peso, stile.
- Prima di confermare una prenotazione ricapitola date, articoli e totale.
- Risposte brevi: è una conversazione, non una scheda prodotto.

### Skills

Quattro pacchetti `agent/skills/<nome>/SKILL.md` con frontmatter `description`,
caricati on-demand dal tool `load_skill`. Sono **procedure**, non superfici di
esecuzione: i tool restano visibili anche a skill non caricata.

| Skill | Procedura |
|---|---|
| `rental` | durata e fasce, regole di consegna/restituzione, cauzione, assicurazione, ritardi |
| `sales` | vendita sci/scarponi/accessori, criteri di taglia, upselling coerente (non aggressivo) |
| `advisor` | intervista in 4 domande → livello/altezza/peso/stile → setup consigliato |
| `faq` | orari, sedi, policy di cancellazione, pagamenti, informazioni generali |

### Tools

`defineTool` da `eve/tools`, input Zod, nome derivato dal filename
(convenzione snake_case della doc eve). Sono gli **unici** a parlare con il
database.

| File | Cosa fa |
|---|---|
| `get_equipment_availability.ts` | disponibilità per categoria/taglia/periodo, incrociando `equipment` e `rentals` |
| `calculate_rental_price.ts` | prezzo da listino: giorni, fascia, assicurazione opzionale, cauzione |
| `create_booking.ts` | crea `booking` + `rental` in transazione, ritorna codice prenotazione |
| `recommend_equipment.ts` | dal profilo (livello/altezza/peso/stile) al setup: sci, lunghezza, scarponi, bastoncini |
| `search_knowledge.ts` | ricerca semantica su `knowledge_documents` |

`create_booking` è l'unico tool che scrive. Nella POC non chiede approvazione
umana; `human-in-the-loop` è annotato in `ROADMAP.md` come passo successivo.

### Il sub-agente voce

```
agent/lib/speech.ts                    transcribe() e synthesize(), model id da env
agent/channels/voice.ts                POST /voice/turn — trasporto + STT + TTS
agent/subagents/voice/agent.ts         description + model da env
agent/subagents/voice/instructions.md  come si parla, non cosa si dice
```

**Flusso di un turno vocale:**

1. `VoiceButton` registra dal microfono (`MediaRecorder`, webm/opus) e fa POST
   dell'audio base64 su `/voice/turn` con il `continuationToken` della sessione.
2. Il canale trascrive con `experimental_transcribe` +
   `gateway.transcriptionModel(process.env.VOICE_STT_MODEL)`.
3. Passa il testo alla sessione dell'agente principale con `send()`, marcando
   `state: { mode: "voice" }`.
4. L'agente principale, in modalità voce, delega al sub-agente `voice` la resa
   parlata della risposta: riceve indietro `{ text, avatarCue }` (output
   strutturato).
5. Il canale sintetizza quel testo via l'endpoint REST del Gateway
   (`/v4/ai/speech-model`, header `ai-model-id`) e lo restituisce come base64.
6. Il client riproduce l'audio; l'`AnalyserNode` alimenta `amplitude` →
   l'avatar muove la bocca.

**Chi fa cosa, senza ambiguità.** STT e TTS sono **deterministici e vivono nel
canale**, non come tool richiamabili dal modello: far passare audio base64 nel
contesto di un LLM costa molto e non serve a niente — il modello non deve
"decidere" di trascrivere, deve ricevere testo. Il sub-agente `voice` è quindi
un **specialista di conversazione parlata**: prende la risposta e la rende
dicibile (frasi brevi, niente markdown né elenchi puntati, numeri pronunciabili,
una domanda alla volta) ed emette il cue per l'avatar. Non conosce prezzi,
inventario, prenotazioni. Il dominio "voce" resta interamente sotto
`agent/subagents/voice/` e `agent/lib/speech.ts`.

**Perché batch e non Realtime.** La modalità Realtime del Gateway apre una
WebSocket dal browser al Gateway e registra i tool nella sessione realtime: ci
sarebbero due orchestratori, in contraddizione con la regola 3. Inoltre richiede
le canary dell'AI SDK. Batch costa ~1–2 s a turno e mantiene i confini.
`ROADMAP.md` documenta cosa cambierebbe per passare a Realtime.

**Astrazione del provider.** `lib/speech.ts` espone `transcribe(audio)` e
`synthesize(text)`. I model id vivono in `VOICE_STT_MODEL` (default
`openai/whisper-1`) e `VOICE_TTS_MODEL` (default `openai/tts-1`). Cambiare
provider è cambiare una env; cambiare *modo* (es. streaming) è riscrivere un
solo file.

**Rischio noto, da scrivere in SETUP.md:** speech-to-text e text-to-speech sul
Gateway sono in beta con rollout graduale — possono non comparire nel catalogo
di un team. Il canale voce risponde con un errore tipizzato e la UI degrada a
testo, senza rompersi.

### Evals

Tre `defineEval` come rete di sicurezza sui confini, non sulla prosa:

1. una domanda su disponibilità chiama `get_equipment_availability`;
2. una domanda sul prezzo non produce mai un numero senza aver chiamato
   `calculate_rental_price`;
3. una richiesta di consiglio attrezzatura raccoglie il profilo prima di
   proporre.

## Database

Neon Postgres, Drizzle ORM, Drizzle Kit, driver `postgres`. Estensione
`pgvector` per la ricerca semantica.

| Tabella | Contenuto |
|---|---|
| `users` | cliente (predisposto per l'auth futura: colonna `external_auth_id` nullable) |
| `conversations` | conversazione lato business, con `eve_session_id` |
| `messages` | trascritto lato business |
| `equipment` | pezzi noleggiabili: categoria, marca, modello, taglia, livello, stato |
| `products` | articoli in vendita: prezzo, taglie, scorte |
| `rentals` | listino noleggio: fasce di durata, prezzo/giorno, cauzione, assicurazione |
| `bookings` | prenotazione: cliente, periodo, righe, totale, stato |
| `knowledge_documents` | policy e informazioni, con `embedding vector(1536)` |

Gli embedding si generano con `embed`/`embedMany` dell'AI SDK su
`openai/text-embedding-3-small` (1536 dimensioni) attraverso il Gateway;
`search_knowledge` fa ricerca per distanza coseno con indice HNSW.

**Nota di onestà architetturale, da riportare in ARCHITECTURE.md:** eve
persiste già le proprie sessioni. `conversations` e `messages` non servono al
runtime dell'agente — esistono per reporting e per l'analisi delle conversazioni.
Il collegamento è `conversations.eve_session_id`.

Seed con inventario realistico: sci all-mountain/piste/freeride in più
lunghezze, scarponi per flex e mondopoint, bastoncini, caschi, listino a fasce
(1/3/6 giorni, settimana), e una decina di documenti di policy.

## Autenticazione

Non implementata. Predisposizione:

- `users.external_auth_id` nullable, pronto per un `id` Clerk o better-auth;
- `docs/ARCHITECTURE.md` con la sezione "dove entra l'auth": middleware Next per
  le pagine, `auth` nel canale eve per le sessioni;
- nessuna dipendenza installata, nessuno stub da rimuovere dopo.

## Deploy

Vercel. `withEve()` fa convivere Next e l'agente in un solo progetto.
Variabili: `DATABASE_URL`, `AI_GATEWAY_API_KEY`, `AGENT_MODEL`,
`VOICE_STT_MODEL`, `VOICE_TTS_MODEL`, `NEXT_PUBLIC_AVATAR_URL`.

In locale servono **due processi**: `pnpm dev` (Next) e l'agente eve. eve esegue
uno snapshot del progetto scattato al proprio avvio: dopo una modifica sotto
`agent/`, riavviare Next non basta — va riavviato eve. Sta in `SETUP.md` perché
è la prima cosa che fa perdere mezz'ora a chi non lo sa.

## Errori e casi limite

| Situazione | Comportamento |
|---|---|
| `DATABASE_URL` assente | i tool falliscono con messaggio esplicito; la chat resta viva e lo dice |
| STT/TTS non abilitati sul team | `/voice/turn` risponde 503 tipizzato, `VoiceStatus` mostra "voce non disponibile", la chat testuale continua |
| Nessun `.vrm` in `public/avatar/` | placeholder procedurale, warning in console, nessun crash |
| WebGL non disponibile | fallback a una card statica con lo stato testuale |
| Microfono negato | `VoiceButton` disabilitato con motivo leggibile |
| `create_booking` su articolo non più disponibile | il tool ritorna un errore di dominio; l'agente riformula la proposta |

## Cosa NON facciamo in questa POC

Pagamenti · autenticazione · dashboard di back-office · multi-tenant ·
notifiche · gestione magazzino · realtime speech-to-speech · approvazione umana
sulle scritture. Tutto in `ROADMAP.md` con la motivazione.

## Assunzioni prese senza chiedere

- shadcn su primitive **Radix** (default della CLI) e icone **lucide**.
- Lingua: identificatori, file e rotte in inglese; commenti, doc e testi utente
  in italiano.
- `app/api/` resta vuota: eve monta le sue rotte da sé, e una route Next che
  chiamasse un modello violerebbe la regola 3.

## Come lo eseguiamo

Pipeline `dev-flow`, con Linear come tracker (progetto nuovo sul team LUC,
milestone per fetta) e `docs/ROADMAP.md` come fonte narrativa:

1. `prd-from-idea` → `PROJECT.md` + `PRD.md`
2. `prd-to-tasks` → `tasks.md` → issue Linear
3. `design-md-to-app` → scaffold Next 16 + shadcn (DESIGN.md scritto a mano)
4. `eve-agent` → `agent/` con tool, skill, sub-agente, canale
5. `module-add db` → Drizzle + Neon + migrazioni + seed
6. avatar, voce, docs
7. `setup-deploy` → Vercel
