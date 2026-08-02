# Ski AI Concierge — Tasks

> Generato da `prd-to-tasks` a partire da PRD.md il 2026-08-02. Compatibile con
> beads, import GitHub Issues, import CSV Linear, sorgente task per ralph-tui.

## Setup

- [ ] **Scaffold Next.js 16 + shadcn/ui** *(addressed by `design-md-to-app`)* — App Router, React 19, Tailwind 4, Biome, pnpm; shadcn su primitive Radix con icone lucide.
  - Acceptance: `pnpm install && pnpm dev` serve una pagina; `pnpm lint` e `pnpm typecheck` passano; `components/ui/` contiene solo output della CLI shadcn.
  - Files: `package.json`, `next.config.ts`, `biome.json`, `app/layout.tsx`, `app/globals.css`, `components.json`
  - Estimated: 2-3h

- [ ] **Configurare Drizzle + Neon + pgvector** *(addressed by `module-add db`)* — driver `postgres`, Drizzle Kit, estensione pgvector, script `db:generate` / `db:migrate` / `db:seed`.
  - Acceptance: con `DATABASE_URL` valorizzato, `pnpm db:migrate` applica le migrazioni su Neon e `CREATE EXTENSION vector` è idempotente; senza `DATABASE_URL` il comando fallisce con messaggio esplicito, non con uno stack trace.
  - Files: `db/index.ts`, `drizzle.config.ts`, `package.json`
  - Estimated: 2h

- [ ] **Scaffold del motore eve** *(addressed by `eve-agent`)* — `agent/agent.ts` con modello da `AGENT_MODEL` via Vercel AI Gateway, `instructions.md` con la persona e le regole non negoziabili, `withEve()` in `next.config.ts`.
  - Acceptance: l'agente risponde su `/eve/v1/**` same-origin; cambiare `AGENT_MODEL` cambia modello senza toccare codice; nessun model id compare fuori da `agent/`.
  - Files: `agent/agent.ts`, `agent/instructions.md`, `next.config.ts`
  - Estimated: 3h

- [ ] **Fissare le convenzioni del repo** — `AGENTS.md` con la regola di lingua (identificatori inglese / testi italiano), i tre confini architetturali e la nota sui due processi in sviluppo.
  - Acceptance: `AGENTS.md` esiste ed è referenziato da `CLAUDE.md`; contiene la nota che eve esegue uno snapshot e va riavviato dopo ogni modifica sotto `agent/`.
  - Files: `AGENTS.md`, `CLAUDE.md`, `.env.example`
  - Estimated: 1-2h

## Epic: La consulenza sull'attrezzatura

### US-1: Come sciatore che non sa cosa gli serve, voglio essere guidato fino a una proposta

- [ ] **Modellare inventario e listino** — tabelle `equipment`, `products`, `rentals` in Drizzle, con categoria, marca, modello, taglia, livello, stato, fasce di durata, cauzione.
  - Acceptance: le migrazioni girano; il seed carica sci all-mountain/piste/freeride in più lunghezze, scarponi per flex e mondopoint, bastoncini e caschi, con un listino a fasce (1/3/6 giorni, settimana).
  - Files: `db/schema.ts`, `db/seed.ts`, `db/migrations/`
  - Estimated: 4h

- [ ] **Scrivere il tool `recommend_equipment`** — dal profilo (livello, altezza, peso, stile) al setup: sci, lunghezza, scarponi, bastoncini, con una motivazione per riga.
  - Acceptance: il tool rifiuta un profilo incompleto invece di indovinare; la lunghezza sci deriva da altezza/peso/livello con una regola documentata; il risultato contiene solo articoli esistenti a magazzino.
  - Files: `agent/tools/recommend_equipment.ts`, `db/schema.ts`
  - Estimated: 4h

- [ ] **Scrivere la skill `advisor`** — la procedura d'intervista in quattro domande e i criteri per tradurre il profilo in un setup.
  - Acceptance: `SKILL.md` con frontmatter `description`; l'agente chiede una domanda alla volta e non propone nulla prima di avere i quattro dati; l'eval "raccoglie il profilo prima di proporre" passa.
  - Files: `agent/skills/advisor/SKILL.md`
  - Estimated: 2h

## Epic: Disponibilità e prezzo

### US-2: Come sciatore con date fissate, voglio sapere se c'è e quanto costa

- [ ] **Scrivere il tool `get_equipment_availability`** — disponibilità per categoria, taglia e periodo, incrociando `equipment` con le prenotazioni già a calendario.
  - Acceptance: due prenotazioni sovrapposte sullo stesso pezzo non risultano entrambe disponibili; se il pezzo richiesto è occupato il tool ritorna le alternative più vicine per taglia e categoria.
  - Files: `agent/tools/get_equipment_availability.ts`
  - Estimated: 4h

- [ ] **Scrivere il tool `calculate_rental_price`** — giorni, fascia di durata, assicurazione opzionale, cauzione, totale scomposto.
  - Acceptance: il totale è scomposto per voce; le fasce di durata si applicano ai giorni effettivi; nessun prezzo è codificato nel tool, tutti vengono da `rentals`.
  - Files: `agent/tools/calculate_rental_price.ts`
  - Estimated: 3h

- [ ] **Scrivere la skill `rental` e la skill `sales`** — regole di noleggio (durata, consegna, restituzione, cauzione, assicurazione, ritardi) e criteri di vendita e upselling coerente.
  - Acceptance: due `SKILL.md` con frontmatter; l'upselling propone al massimo un articolo aggiuntivo e solo se pertinente al setup già scelto.
  - Files: `agent/skills/rental/SKILL.md`, `agent/skills/sales/SKILL.md`
  - Estimated: 2-3h

## Epic: La prenotazione

### US-3: Come sciatore convinto, voglio prenotare senza uscire dalla conversazione

- [ ] **Modellare `bookings` e `users`** — prenotazione con cliente, periodo, righe, totale, stato; `users.external_auth_id` nullable per l'auth futura.
  - Acceptance: le righe di prenotazione referenziano `equipment`; lo stato ha valori espliciti; la colonna per l'auth esiste e non è usata da nulla.
  - Files: `db/schema.ts`, `db/migrations/`
  - Estimated: 2-3h

- [ ] **Scrivere il tool `create_booking`** — crea prenotazione e righe in transazione, ritorna un codice leggibile.
  - Acceptance: la scrittura è transazionale; se un articolo non è più disponibile il tool ritorna un errore di dominio tipizzato e non scrive nulla; il codice prenotazione è leggibile ad alta voce.
  - Files: `agent/tools/create_booking.ts`
  - Estimated: 4h

## Epic: Informazioni e policy

### US-4: Come sciatore con dubbi, voglio risposte su cauzione, cancellazione, ritardi

- [ ] **Modellare `knowledge_documents` con embedding** — colonna `vector(1536)`, indice HNSW, indicizzazione nel seed con `embedMany` su `openai/text-embedding-3-small` via Gateway.
  - Acceptance: il seed genera gli embedding e li scrive; l'indice esiste; rilanciare il seed non duplica i documenti.
  - Files: `db/schema.ts`, `db/seed.ts`, `db/migrations/`
  - Estimated: 3-4h

- [ ] **Scrivere il tool `search_knowledge` e la skill `faq`** — ricerca per distanza coseno sui documenti del negozio, più la procedura per rispondere senza improvvisare.
  - Acceptance: il tool ritorna i passaggi con il punteggio; sotto una soglia di similarità ritorna vuoto e la skill impone di dichiarare che la documentazione non copre la domanda.
  - Files: `agent/tools/search_knowledge.ts`, `agent/skills/faq/SKILL.md`
  - Estimated: 3h

## Epic: L'esperienza — chat, avatar, voce

### US-5: Come sciatore che preferisce parlare, voglio usare il microfono e sentire la risposta

- [ ] **Costruire la schermata e il pannello chat** — header, due colonne (avatar / chat), barra voce; `ChatPanel` su `useEveAgent()`, `MessageList`, `ChatInput`, con stati di caricamento, vuoto ed errore.
  - Acceptance: la conversazione arriva in streaming; sotto `md` le colonne si impilano; nessun import di `ai` o `@ai-sdk/*` sotto `app/` o `components/`.
  - Files: `app/page.tsx`, `components/chat/*`
  - Estimated: 5-6h

- [ ] **Mappare gli eventi eve sugli stati dell'avatar** — `AvatarState.ts` e `AvatarController.tsx` come unico ponte fra stream e scena 3D.
  - Acceptance: la tabella evento → stato del design è implementata per intero; `Avatar3D` riceve solo `{ state, amplitude }`; la mappatura è testata sugli eventi `turn.started`, `actions.requested`, `message.appended`, `turn.completed`.
  - Files: `components/avatar/AvatarState.ts`, `components/avatar/AvatarController.tsx`
  - Estimated: 3h

- [ ] **Costruire la scena 3D con VRM e il fallback** — R3F, `@pixiv/three-vrm`, inquadratura a mezza figura, animazione di idle; placeholder procedurale se l'asset manca.
  - Acceptance: senza `.vrm` in `public/avatar/` la pagina non crasha e mostra il placeholder con gli stessi quattro stati; senza WebGL si degrada a una card statica; il modello si sostituisce con `NEXT_PUBLIC_AVATAR_URL`.
  - Files: `components/avatar/Avatar3D.tsx`, `components/avatar/AvatarCanvas.tsx`, `components/avatar/animations/idle.ts`
  - Estimated: 6h

- [ ] **Costruire il turno vocale lato eve** — `agent/lib/speech.ts` (STT con `experimental_transcribe`, TTS via endpoint REST del Gateway), canale `agent/channels/voice.ts` su `POST /voice/turn`, rewrite in `next.config.ts`.
  - Acceptance: un POST con audio base64 e `continuationToken` ritorna testo e audio di risposta; i model id vengono da `VOICE_STT_MODEL` e `VOICE_TTS_MODEL`; se i modelli audio non sono nel catalogo del team, il canale risponde 503 tipizzato.
  - Files: `agent/lib/speech.ts`, `agent/channels/voice.ts`, `next.config.ts`
  - Estimated: 5-6h

- [ ] **Aggiungere il sub-agente `voice` e i comandi vocali nella UI** — sub-agente per la resa parlata (`{ text, avatarCue }`), `VoiceButton` con `MediaRecorder`, `VoiceStatus`, lip sync da `AnalyserNode`.
  - Acceptance: il sub-agente non ha accesso a prezzi, inventario e prenotazioni; microfono negato disabilita il pulsante con motivo leggibile; voce non disponibile mostra lo stato e lascia viva la chat; la bocca segue l'audio in riproduzione.
  - Files: `agent/subagents/voice/*`, `components/voice/*`, `components/avatar/animations/lipSync.ts`
  - Estimated: 6h

## Chiusura

- [ ] **Scrivere gli eval dell'agente** — tre casi: sceglie la skill giusta, non produce prezzi senza tool, raccoglie il profilo prima di consigliare.
  - Acceptance: `pnpm eval` gira e i tre casi passano contro il dev server.
  - Files: `evals/*.ts`
  - Estimated: 3h

- [ ] **Scrivere la documentazione** — `README.md` (installazione, sviluppo, deploy, struttura), `docs/ARCHITECTURE.md` (diagrammi, flussi, responsabilità, dove entra l'auth), `docs/AGENTS.md` (agente, skill, tool, sub-agente voce), `docs/ROADMAP.md`, `docs/SETUP.md`.
  - Acceptance: `SETUP.md` copre i due processi in sviluppo, lo snapshot di eve, le variabili d'ambiente e il rischio beta sui modelli audio; `ARCHITECTURE.md` spiega perché `conversations`/`messages` non servono al runtime dell'agente.
  - Files: `README.md`, `docs/*.md`
  - Estimated: 4h

- [ ] **Configurare il deploy su Vercel** *(addressed by `setup-deploy`)* — un solo progetto per app e agente, variabili d'ambiente, build verificata.
  - Acceptance: `pnpm build` passa in locale; il progetto Vercel ha `DATABASE_URL`, `AI_GATEWAY_API_KEY`, `AGENT_MODEL`, `VOICE_STT_MODEL`, `VOICE_TTS_MODEL`, `NEXT_PUBLIC_AVATAR_URL`; la preview risponde sia sulla chat sia su `/voice/turn`.
  - Estimated: 2-3h

## Non-goals (do NOT do)

- Pagamenti e checkout — la prenotazione si chiude senza incasso.
- Autenticazione — solo la colonna nullable di predisposizione, nessuna dipendenza installata.
- Back-office per il negozio — listino, magazzino e policy si popolano dal seed.
- Multi-tenant — un solo negozio; lo scoping resta una nota architetturale.
- Realtime speech-to-speech — aprirebbe un secondo orchestratore accanto a eve.
- Approvazione umana sulle scritture — annotata in roadmap, non implementata.
- Mobile nativo — solo web responsive.

## Open questions

- Listino e policy reali di un negozio, al posto dei dati verosimili ma inventati del seed.
- L'asset VRM: commissionarlo, generarlo o comprarlo — serve licenza chiara e aspetto da maestro di sci.
- Quale voce e quale timbro, e se il modello TTS regge l'italiano.
- Verificare che il team Vercel abbia i modelli audio nel catalogo del Gateway: senza, la US-5 non è dimostrabile.
- Se una demo per investitori debba mostrare anche un acquisto, non solo un noleggio.
