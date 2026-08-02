import type { Metadata } from "next";
import Link from "next/link";
import { SiteTopNav } from "@/components/shared/site/site-top-nav";
import { WordmarkFooter } from "@/components/shared/site/wordmark-footer";
import { Button } from "@/components/ui/button";
import { Code, Note, Section, T, Table } from "./_components/DocPieces";

export const metadata: Metadata = {
  title: "Doc — Ski AI Concierge",
  description:
    "Come e' fatto il concierge: l'agente eve, la voce realtime sul Vercel AI Gateway, l'avatar e il lip sync.",
};

export default function DocPage() {
  return (
    <>
      <SiteTopNav />
      <main className="flex-1 bg-background">
        {/* ------------------------------------------------------------- */}
        <section className="border-b border-outline">
          <div className="mx-auto max-w-[860px] space-y-6 px-4 py-20 lg:px-12">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide text-on-surface-variant">
              Documentazione tecnica
            </p>
            <h1
              className="font-[family-name:var(--font-space-grotesk)] font-semibold"
              style={{
                fontSize: "clamp(36px, 6vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              Come e' fatto il concierge.
            </h1>
            <p className="max-w-[62ch] text-[17px] leading-[1.6] text-on-surface-variant">
              Un assistente con avatar 3D per un negozio di noleggio sci. Ci si
              parla a voce, risponde a voce, e ogni numero che pronuncia — una
              disponibilita', un prezzo, una policy — viene da uno strumento che
              interroga il negozio. Non da un modello che ricorda.
            </p>
            <p className="max-w-[62ch] text-[17px] leading-[1.6] text-on-surface-variant">
              Questa pagina spiega come sta insieme: cosa fa <strong>eve</strong>,
              come funziona la conversazione in tempo reale sul{" "}
              <strong>Vercel AI Gateway</strong>, e come l'avatar muove la bocca
              su quello che sente.
            </p>
            <Button
              size="lg"
              className="h-12 px-6"
              nativeButton={false}
              render={<Link href="/concierge" />}
            >
              Provalo
            </Button>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="Il quadro" title="I pezzi e chi parla con chi">
          <p>
            Tre attori. Il <strong>browser</strong> mostra l'avatar e la chat.
            La <strong>sessione vocale</strong> vive sul Gateway e conversa col
            cliente. <strong>eve</strong> e' il cervello del negozio: sceglie le
            procedure, chiama gli strumenti, legge i dati.
          </p>
          <Code>{`browser ──── WebSocket ────► modello vocale realtime (AI Gateway)
   │                            │
   │                            │ chiama un solo strumento:
   │                            │ "chiedi_al_negozio"
   │                            ▼
   └──── /eve/v1/** ──────► agente eve
                                │
                                ├─ skills/   procedure caricate al bisogno
                                ├─ tools/    disponibilita', prezzo, prenotazione
                                └─ db/       Neon, o il catalogo in memoria`}</Code>
          <p>
            Il modello vocale <em>sente e parla</em>. Non conosce prezzi ne'
            magazzino: quando la conversazione tocca qualcosa di reale chiama il
            suo unico strumento, che dietro esegue un turno eve intero e gli
            restituisce la risposta da dire.
          </p>
          <Note>
            <strong>Perche' cosi'.</strong> Un modello vocale con dieci strumenti
            in mano diventa lui l'orchestratore, e la logica del negozio finisce
            sparsa fra due sistemi. Con un solo strumento resta quello che deve
            essere — orecchie e bocca — e le regole del negozio restano in un
            posto solo.
          </Note>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="I confini" title="Tre regole che il codice rende vere">
          <Table
            head={["Regola", "Come si verifica"]}
            rows={[
              [
                "Il frontend non conosce i modelli AI",
                <>
                  Nessun file sotto <T>app/</T> o <T>components/</T> importa{" "}
                  <T>ai</T> o contiene un identificativo di modello. Persino la
                  pagina del concierge riceve il modello vocale come proprieta',
                  letta dal server.
                </>,
              ],
              [
                "Il frontend non tocca i dati",
                <>
                  <T>db/</T> e' importato solo da <T>agent/tools/*</T>. Se un
                  componente React importasse <T>db/</T>, il confine sarebbe
                  rotto.
                </>,
              ],
              [
                "eve e' l'unico orchestratore",
                <>
                  In <T>app/api/</T> ci sono due rotte, e nessuna decide niente:
                  una conia il gettone della sessione vocale, l'altra legge il
                  saldo dei crediti.
                </>,
              ],
            ]}
          />
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="eve" title="L'agente, e cosa gli abbiamo dato">
          <p>
            In eve <strong>l'identita' viene dal percorso del file</strong>:{" "}
            <T>agent/tools/create_booking.ts</T> <em>e'</em> lo strumento{" "}
            <T>create_booking</T>. Non c'e' un registro da tenere allineato.
          </p>
          <Code>{`agent/
├── agent.ts            il modello, preso da una variabile d'ambiente
├── instructions.md     chi e', come parla, cosa non deve fare
├── skills/             procedure caricate al bisogno
│   ├── advisor/        l'intervista in quattro domande
│   ├── rental/         durata, cauzione, assicurazione, ritardi
│   ├── sales/          quando conviene comprare invece di noleggiare
│   └── faq/            orari, pagamenti, cancellazioni
├── tools/              i cinque strumenti del negozio (+ i predefiniti spenti)
└── lib/                il catalogo in memoria, i modelli della voce`}</Code>

          <h3 className="pt-2 text-[19px] font-semibold">Le skill</h3>
          <p>
            Sono <strong>procedure</strong>, non codice: un file markdown con una
            descrizione in testa. Il modello le carica quando servono con{" "}
            <T>load_skill</T>, cosi' le istruzioni di base restano corte e la
            competenza arriva al momento giusto. La skill <T>advisor</T>, per
            dire, impone di raccogliere livello, altezza, peso e stile{" "}
            <em>prima</em> di proporre qualcosa — una domanda alla volta.
          </p>

          <h3 className="pt-2 text-[19px] font-semibold">Gli strumenti</h3>
          <Table
            head={["Strumento", "Cosa fa"]}
            rows={[
              [
                <T>get_equipment_availability</T>,
                "Cosa e' libero per categoria, taglia e date, incrociando magazzino e prenotazioni. Se la misura esatta e' occupata propone le alternative piu' vicine.",
              ],
              [
                <T>calculate_rental_price</T>,
                "Il prezzo da listino: giorni, fascia di durata, cauzione, assicurazione. Nessun importo e' scritto nel codice.",
              ],
              [
                <T>recommend_equipment</T>,
                "Dal profilo al setup: lunghezza sci, mondopoint, flex. La regola e' scritta per intero, cosi' il modello non ne inventa una propria.",
              ],
              [
                <T>create_booking</T>,
                "L'unico che scrive. Ricontrolla la disponibilita' dentro la transazione e ritorna un codice leggibile ad alta voce.",
              ],
              [
                <T>search_knowledge</T>,
                "Cerca nelle policy del negozio. Col database fa ricerca semantica su pgvector; senza, per parole.",
              ],
            ]}
          />
          <Note tone="warning">
            <strong>Gli otto strumenti spenti.</strong> Ogni agente eve nasce con{" "}
            <T>bash</T>, i tool sul filesystem e quelli sul web — il{" "}
            <em>default harness</em>. Qui sono disattivati con{" "}
            <T>disableTool()</T>, che e' il meccanismo previsto dalla doc. Non e'
            pignoleria: il modello chiamava <T>bash</T> per rispondere a una
            domanda sui noleggi e la sessione restava appesa per minuti su una
            sandbox che non abbiamo configurato. Il perche' completo sta in{" "}
            <T>agent/tools/README.md</T>.
          </Note>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="La voce" title="Realtime speech-to-speech, non tre salti">
          <p>
            La prima versione faceva tre salti: audio → testo con Whisper, testo
            → ragionamento, testo → audio con un modello di sintesi. La latenza
            era la somma dei tre, e si sentiva.
          </p>
          <p>
            Ora e' un salto solo. Il modello <T>openai/gpt-realtime-2.1</T> sul
            Gateway <strong>sente e parla</strong>, con i turni gestiti dalla
            rilevazione di voce lato server.
          </p>
          <Code>{`1. il browser chiede un gettone      POST /api/realtime/token
2. il server lo conia col Gateway    gateway.experimental_realtime.getToken()
   → la chiave non lascia mai il server: torna un segreto monouso
3. il browser apre la WebSocket      useRealtime({ model, api: { token } })
4. il microfono entra nella sessione startAudioCapture(stream)`}</Code>
          <p>
            La rotta del gettone dichiara anche <strong>l'unico strumento</strong>{" "}
            della sessione vocale, <T>chiedi_al_negozio</T>. Quando il modello lo
            chiama, il browser inoltra la domanda alla sessione eve gia' aperta e
            restituisce la risposta: e' il ponte fra la voce e il negozio.
          </p>
          <Note>
            <strong>Due dettagli che costano ore se non li sai.</strong> Le
            modalita' di uscita accettate sono <T>['text']</T> oppure{" "}
            <T>['audio']</T>, mai entrambe. E il modello di trascrizione va
            passato col nome nativo del provider — <T>whisper-1</T>, non{" "}
            <T>openai/whisper-1</T>. In entrambi i casi la sessione non parte
            proprio.
          </Note>
          <p>
            La trascrizione e' attiva nei due versi, ed e' quella che tiene la
            chat sincronizzata: scrive sia quello che dici tu sia quello che
            risponde l'avatar. I Grok Voice non la reggono — la doc del Gateway
            dice che fanno solo speech-to-speech — quindi con quelli la
            conversazione funziona ma la chat resta muta.
          </p>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="L'avatar" title="Quattro stati, e una bocca che segue le vocali">
          <p>
            La scena 3D non sa niente di eve, di modelli o di prenotazioni.
            Riceve due cose: uno <strong>stato</strong> fra{" "}
            <T>idle · listening · thinking · speaking</T>, e i{" "}
            <strong>pesi dei visemi</strong>. Tutta la traduzione dal mondo
            dell'agente sta in un file solo, <T>AvatarState.ts</T>.
          </p>

          <h3 className="pt-2 text-[19px] font-semibold">Il lip sync</h3>
          <p>
            Dall'ampiezza dell'audio si ricava solo <em>quanto</em> e' aperta la
            bocca, e il risultato e' una mandibola che va su e giu'. Per sapere{" "}
            <em>quale</em> vocale servono le formanti: i due picchi di risonanza
            del tratto vocale che distinguono una A da una I anche a volume
            identico.
          </p>
          <Code>{`sui campioni PCM che arrivano dalla sessione vocale:
  1. finestra di Hann          non sporca lo spettro ai bordi del blocco
  2. FFT                       scritta a mano, venti righe
  3. F1 fra 250 e 900 Hz       il primo picco
     F2 fra 900 e 2800 Hz      il secondo
  4. la coppia (F1, F2) si confronta con le cinque vocali italiane
     e i pesi escono per distanza inversa, in scala logaritmica`}</Code>
          <p>
            I pesi pilotano i visemi Oculus del modello —{" "}
            <T>viseme_aa</T>, <T>viseme_I</T>, <T>viseme_U</T>, <T>viseme_E</T>,{" "}
            <T>viseme_O</T> — piu' <T>jawOpen</T> che accompagna. Verificato
            sintetizzando le cinque vocali alle loro formanti: le riconosce tutte
            con margine netto.
          </p>
          <Note>
            <strong>La bocca segue il tempo dell'audio, non della rete.</strong>{" "}
            I blocchi arrivano prima di quando si sentono, perche' il player ne
            accumula qualche decimo di secondo. Ogni blocco entra in coda con la
            propria durata e un ciclo la consuma al ritmo dell'orologio —
            altrimenti la bocca parte in anticipo, si muove a raffica e poi resta
            senza materiale.
          </Note>
          <p>
            Il modello e' un <T>.glb</T> con 72 morph target e uno scheletro di
            67 ossa. Si sostituisce mettendo un altro file in{" "}
            <T>public/avatar/</T>; <T>pnpm avatar:inspect</T> dice se e'
            animabile prima ancora di aprire il browser. Sono supportati anche i
            VRM, e i modelli senza blendshape: in quel caso si ruota l'osso della
            mandibola.
          </p>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="I dati" title="Neon, oppure il negozio in memoria">
          <p>
            Lo schema Drizzle ha magazzino, listino a fasce, catalogo di vendita,
            prenotazioni e documentazione con embedding su <T>pgvector</T>.
          </p>
          <Code>{`users · conversations · messages
equipment · products · rental_rates
bookings · rentals
knowledge_documents (embedding vector(1536), indice HNSW)`}</Code>
          <p>
            Se <T>DATABASE_URL</T> non e' configurata i cinque strumenti leggono
            da un catalogo in memoria che rispecchia il seed: la demo gira lo
            stesso, prenotazioni comprese, e i pezzi prenotati risultano
            davvero occupati. Col database collegato non cambia una riga di
            codice.
          </p>
          <Note tone="warning">
            I dati sono verosimili ma <strong>inventati</strong>. Prima di
            mostrarli a chi il mestiere lo conosce vanno sostituiti con i listini
            veri di un negozio.
          </Note>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="Farlo girare" title="Due processi, una chiave">
          <Code>{`git clone https://github.com/lukedj78/ski-ai-concierge
cd ski-ai-concierge
nvm use              # eve richiede Node >= 24
pnpm install
cp .env.example .env.local   # e incolla AI_GATEWAY_API_KEY
pnpm dev`}</Code>
          <p>
            <T>pnpm dev</T> avvia Next e, accanto, il server di eve. Attenzione a
            una cosa che fa perdere mezz'ora: <strong>eve esegue uno snapshot</strong>{" "}
            del progetto scattato al proprio avvio. Dopo una modifica sotto{" "}
            <T>agent/</T>, riavviare la pagina non basta — va riavviato il
            processo.
          </p>
          <Table
            head={["Variabile", "A cosa serve"]}
            rows={[
              [
                <T>AI_GATEWAY_API_KEY</T>,
                "L'unica credenziale: testo, voce realtime, embedding, saldo.",
              ],
              [
                <T>DATABASE_URL</T>,
                "Neon. Se manca, il negozio vive in memoria.",
              ],
              [
                <T>AGENT_MODEL</T>,
                "Il modello che ragiona. Cambiarlo non tocca il codice.",
              ],
              [
                <T>REALTIME_MODEL</T>,
                "Il modello vocale. Attenzione ai Grok Voice: niente trascrizione.",
              ],
              [
                <T>NEXT_PUBLIC_SHOW_TOOLS</T>,
                "Mostra in chat gli strumenti che girano. Da spegnere in produzione.",
              ],
            ]}
          />
          <p>
            Il deploy e' un progetto Vercel solo: <T>withEve()</T> fa convivere
            l'app e l'agente, e le rotte del protocollo finiscono sul servizio di
            eve.
          </p>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section eyebrow="Onesta'" title="Cosa non c'e', e perche'">
          <Table
            head={["Manca", "Motivo"]}
            rows={[
              [
                "Pagamenti",
                "La prenotazione si chiude senza incasso: si paga al banco.",
              ],
              [
                "Autenticazione",
                "Solo una colonna nullable di predisposizione per Clerk o better-auth. Nessuna dipendenza installata.",
              ],
              [
                "Multi-tenant",
                "Un solo negozio. Lo scoping per tenant e' una nota architetturale, non codice.",
              ],
              [
                "Approvazione umana sulle scritture",
                <>
                  eve ha <T>human-in-the-loop</T> e questo prodotto lo merita
                  prima di andare live: creare una prenotazione e' irreversibile.
                </>,
              ],
              [
                "Le consonanti nel lip sync",
                "Le formanti distinguono le vocali. Una B e una M chiudono le labbra allo stesso modo e questo metodo non le separa.",
              ],
            ]}
          />
        </Section>
      </main>
      <WordmarkFooter />
    </>
  );
}
