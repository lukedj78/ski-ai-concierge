# Ski AI Concierge — PRD

## Problem

Marco parte per la Val di Fassa fra tre settimane. Scia da otto anni, un paio di
settimane a stagione, sempre in pista, 178 cm per 76 kg. Apre il sito del
noleggio e trova un modulo: categoria (all-mountain / piste / freeride / junior),
lunghezza sci in centimetri, misura scarpone, date.

Non sa quale categoria gli serve. Non sa se 170 o 165. Non sa che il numero di
scarpa non è il mondopoint. Quindi fa una di tre cose: sceglie a caso, chiama il
negozio, o rimanda tutto al banco.

Dall'altra parte il negozio ha il problema speculare. In alta stagione il banco è
la strozzatura: metà delle persone in coda sono lì per decidere cose che si
sarebbero potute decidere online, e ogni cambio di attrezzatura è un pezzo che
torna a magazzino e un cliente che aspetta. Il carrello medio resta basso perché
nessuno propone il casco, l'assicurazione o lo scarpone migliore a chi compila un
modulo da solo.

La competenza esiste, sta al banco, e online non ci arriva.

## Solution overview

Il negozio mette sul proprio sito un concierge: un maestro di sci con avatar 3D
con cui si parla o si scrive.

La conversazione parte dal problema del cliente, non dal catalogo. Se Marco
scrive «vado in Val di Fassa a febbraio, cosa mi serve?», il concierge fa le
domande dell'addetto — livello, altezza, peso, dove scia — e da lì propone un
setup preciso: modello, lunghezza, scarpone in mondopoint, accessori. Non è una
lista di prodotti: è una proposta motivata, come al banco.

Ogni numero che pronuncia viene da un tool: la disponibilità è quella vera per
quelle date, il prezzo è quello del listino con le fasce di durata, le policy
sono quelle del negozio. L'assistente non stima e non ricorda: consulta. Quando
Marco è convinto, la stessa conversazione arriva alla prenotazione, con un
riepilogo di date, articoli e totale prima di confermare.

L'avatar non è decorazione: è il segnale di stato. Ascolta, pensa, parla — e si
vede. Chi parla a voce capisce quando è il suo turno senza leggere niente.

Sotto, un unico orchestratore: l'agente eve sceglie la competenza da caricare
(noleggio, vendita, consulenza, informazioni) e i tool da chiamare. Il frontend
non sa quali modelli girano né dove sono i dati.

## User stories (MVP)

- **US-1.** Come sciatore che non sa cosa gli serve, voglio essere guidato con
  qualche domanda fino a una proposta di attrezzatura, così da non dover decidere
  da solo cose che non so valutare.
  - L'assistente raccoglie livello, altezza, peso e stile di sciata prima di
    proporre — se mancano, li chiede, una domanda alla volta.
  - La proposta contiene modello, lunghezza sci, misura scarpone in mondopoint e
    accessori, ciascuno con una riga di motivazione.
  - La proposta esce da `recommend_equipment`, mai dal modello a memoria.
  - Se il profilo è incompleto, l'assistente lo dice invece di indovinare.

- **US-2.** Come sciatore con date già fissate, voglio sapere se l'attrezzatura è
  disponibile e quanto costa, così da decidere subito.
  - Disponibilità da `get_equipment_availability` per categoria, taglia e
    periodo.
  - Prezzo da `calculate_rental_price`: giorni, fascia di durata, cauzione,
    assicurazione opzionale, con il totale scomposto.
  - Se un pezzo non è disponibile, l'assistente propone l'alternativa più vicina
    invece di fermarsi.
  - Nessun prezzo compare in chat senza una chiamata di tool a monte.

- **US-3.** Come sciatore convinto, voglio prenotare senza uscire dalla
  conversazione, così da chiudere in un colpo solo.
  - Prima di scrivere, l'assistente ricapitola date, articoli e totale e chiede
    conferma esplicita.
  - `create_booking` crea prenotazione e righe in transazione e ritorna un codice
    leggibile.
  - Se nel frattempo l'articolo non è più disponibile, il tool fallisce con un
    errore di dominio e l'assistente riformula la proposta.

- **US-4.** Come sciatore con dubbi sulle condizioni, voglio risposte su cauzione,
  cancellazione, ritardi nella restituzione e assicurazione, così da sapere a
  cosa vado incontro.
  - Le risposte vengono da `search_knowledge` sui documenti del negozio.
  - Se la documentazione non copre la domanda, l'assistente lo dice e non
    improvvisa una policy.

- **US-5.** Come sciatore che preferisce parlare, voglio usare il microfono e
  sentire la risposta, così da fare tutto senza digitare.
  - Un turno vocale completo: registrazione, trascrizione, risposta, audio di
    ritorno.
  - L'avatar attraversa `listening → thinking → speaking → idle` in modo
    coerente con lo stato reale della sessione.
  - La bocca segue l'audio in riproduzione.
  - Se la voce non è disponibile sul team Vercel, la UI lo dichiara e la chat
    testuale continua a funzionare.

## Post-MVP

Approvazione umana prima delle scritture · realtime speech-to-speech ·
multilingua · vendita con checkout · sincronizzazione col gestionale di magazzino
· pannello per il negozio per curare listino e policy.

## Non-goals

- **Pagamenti.** La prenotazione si chiude senza incasso; si paga al banco.
- **Autenticazione.** Nessun login. Predisposizione a Clerk o better-auth via una
  colonna nullable, nessuna dipendenza installata.
- **Back-office.** Listino, magazzino e policy si popolano dal seed.
- **Multi-tenant.** Un solo negozio. Lo scoping per tenant è una decisione
  architetturale annotata, non implementata.
- **Realtime speech-to-speech.** Deliberato: aprirebbe una WebSocket dal browser
  al Gateway con i tool registrati nella sessione realtime, cioè un secondo
  orchestratore accanto a eve.
- **Mobile nativo.** Solo web responsive.

## Technical constraints

- **Next.js 16 + App Router, React 19, TypeScript, Tailwind CSS 4.** Biome per
  formattazione e lint, pnpm come package manager.
- **shadcn/ui è l'unica libreria di componenti**, su primitive Radix, icone
  lucide. Nessun'altra libreria UI.
- **eve è l'unico orchestratore agentico.** Skill, tool e sub-agenti vivono nel
  paradigma eve; nessuna logica agentica nelle route Next.
- **Il frontend non conosce i modelli AI** e non parla con database, tool o
  servizi esterni: solo `useEveAgent()` e lo stream di eventi.
- **Il modello è configurabile da variabile d'ambiente** e passa dal Vercel AI
  Gateway; cambiarlo non tocca il codice applicativo.
- **Solo i tool eve accedono al database**, alle API esterne e ai servizi.
- **Neon PostgreSQL con Drizzle ORM e Drizzle Kit**, estensione pgvector per la
  ricerca semantica.
- **Avatar:** React Three Fiber + Three.js, modello VRM a mezza figura, pronto per
  lip sync, con fallback procedurale se l'asset manca.
- **Deploy su Vercel**, un solo progetto per app e agente via `withEve()`.
- **Lingua del codice:** identificatori, nomi di file e rotte in inglese;
  commenti, documentazione e testi utente in italiano.
- **Vincolo esterno noto:** speech-to-text e text-to-speech sul Vercel AI Gateway
  sono in beta con rollout graduale per team. Il prodotto deve degradare a chat
  testuale, non rompersi.

## Open questions

- **Listino e policy reali.** Il seed usa dati verosimili ma inventati. Servono i
  listini veri di un negozio prima di mostrare la demo a chi quel mestiere lo
  conosce.
- **L'asset dell'avatar.** Serve un VRM a mezza figura con licenza chiara e un
  aspetto da maestro di sci. Da decidere: commissionarlo, generarlo, o comprarlo.
- **La voce.** Quale voce e quale timbro per un maestro di sci italiano — e se il
  modello TTS scelto la regge in italiano.
- **Accesso beta.** Verificare che il team Vercel abbia i modelli audio nel
  catalogo del Gateway; senza, la US-5 non è dimostrabile.
- **Perimetro della vendita.** Il PRD copre la consulenza sulla vendita ma non il
  checkout: da chiarire se una demo per investitori deve mostrare anche un
  acquisto, non solo un noleggio.
