"use client";

import { gateway } from "@ai-sdk/gateway";
import { experimental_useRealtime as useRealtime } from "@ai-sdk/react";
import { experimental_decodeRealtimeAudio as decodeRealtimeAudio } from "ai";
import { Mic01Icon, MicOff01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEveAgent } from "eve/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarController } from "@/components/avatar/AvatarController";
import { useVisemeTimeline } from "@/components/avatar/animations/useVisemeTimeline";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CreditMeter } from "@/components/voice/CreditMeter";
import { MicLevelRing } from "@/components/voice/MicLevelRing";
import { VoiceStatus } from "@/components/voice/VoiceStatus";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * La schermata del concierge.
 *
 * Una sola via vocale: **realtime speech-to-speech** attraverso il Vercel AI
 * Gateway. Il modello sente e parla; quando la conversazione tocca prezzi,
 * disponibilita' o policy chiama il suo unico strumento, che dietro esegue un
 * turno eve intero — skill, tool, database.
 *
 * Il ciclo di vita e' quello di un assistente da banco: entri, ti saluta,
 * accendi il microfono quando vuoi parlare e lo spegni quando hai finito.
 */

/**
 * Frequenza di campionamento della sessione vocale. Serve anche all'analisi
 * delle formanti: sbagliarla sposta tutte le frequenze e la vocale stimata.
 */
const AUDIO_SAMPLE_RATE = 24_000;

/**
 * Il contesto con cui la voce interroga il negozio.
 *
 * Chi chiede non e' il cliente ma un altro modello, che dira' lui la risposta
 * ad alta voce: qui serve la sostanza, subito, senza preamboli e senza
 * chiedere niente. Ogni giro di modello in piu' e' un secondo di silenzio in
 * conversazione.
 */
/** Il primo valore testuale degli argomenti, per etichettare la chiamata. */
function firstArgument(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  for (const value of Object.values(input as Record<string, unknown>)) {
    if (typeof value === "string" && value.length <= 40) return value;
  }
  return null;
}

const BRIDGE_CONTEXT = `Questa domanda arriva dalla sessione vocale, non dal cliente: chi la riceve la leggera' ad alta voce.

Rispondi con la sostanza e basta: niente saluti, niente "un attimo controllo", nessuna domanda di rimando. Se servono i tool chiamali subito, senza annunciarlo. Al massimo tre frasi, con i numeri esatti che tornano dai tool.`;

export type ConciergeShellProps = {
  /** Identificativo Gateway del modello vocale, deciso dal sub-agente voce. */
  model: string;
  /** Voce del modello, decisa dallo stesso sub-agente. */
  voice: string;
  /** Modello di trascrizione, per far comparire in chat anche cio' che dici. */
  transcription: string;
  /** URL del modello 3D. */
  avatarUrl: string | null;
};

export function ConciergeShell({
  model: modelId,
  voice,
  transcription,
  avatarUrl,
}: ConciergeShellProps) {
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * La bocca segue il tempo dell'audio, non quello della rete: i blocchi
   * arrivano in anticipo rispetto a quando si sentono, e la linea temporale li
   * consuma al ritmo giusto. Vedi `useVisemeTimeline`.
   */
  const {
    mouth,
    push: pushAudio,
    reset: resetMouth,
  } = useVisemeTimeline(AUDIO_SAMPLE_RATE);
  const [micOn, setMicOn] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  // Lo stesso flusso anche come stato: l'anello che reagisce alla voce deve
  // sapere quando compare e quando sparisce, e un riferimento non lo dice.
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  // "Sta parlando" e' uno stato di React, ma cambia due volte per frase, non
  // cinquanta al secondo: si accende al primo blocco audio e si spegne dopo un
  // po' di silenzio.
  const [voiceActive, setVoiceActive] = useState(false);

  /**
   * Cosa sta facendo il negozio mentre il cliente aspetta.
   *
   * Senza, fra la domanda e la risposta non succede niente sullo schermo: la
   * conversazione sembra piantata proprio nel momento in cui sta lavorando.
   * In questa fase di prova mostriamo anche quali tool girano.
   */
  const [thinking, setThinking] = useState<{
    question: string;
    tools: string[];
  } | null>(null);

  /** Il modello vocale sta preparando una risposta. */
  const [responding, setResponding] = useState(false);

  // Cresce a ogni turno concluso: fa rileggere il saldo del Gateway.
  const [turnsDone, setTurnsDone] = useState(0);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greeted = useRef(false);
  const askResolver = useRef<{
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  /** I blocchi di testo del turno in corso, da unire alla fine. */
  const parts = useRef<string[]>([]);

  // La sessione eve: e' il cervello. Il modello vocale la interroga tramite il
  // suo unico strumento; qui si aspetta la risposta e la si restituisce.
  const agent = useEveAgent({
    onEvent(event) {
      // I tool che partono si vedono man mano, non a cose fatte.
      if (event.type === "actions.requested") {
        // Le azioni non sono tutte chiamate a tool: `load-skill` e le
        // deleghe ai sub-agenti hanno una forma diversa.
        const names = event.data.actions.map((action) => {
          if (action.kind !== "tool-call") return action.kind;
          // L'argomento distingue due chiamate allo stesso tool: due
          // `load_skill` di fila sono due skill diverse, non un doppione.
          const argument = firstArgument(action.input);
          return argument
            ? `${action.toolName} · ${argument}`
            : action.toolName;
        });
        setThinking((current) =>
          current
            ? { ...current, tools: [...current.tools, ...names] }
            : current,
        );
        return;
      }

      const waiting = askResolver.current;
      if (!waiting) return;

      // I blocchi di testo si accumulano: un turno puo' produrne piu' di uno,
      // per esempio un "un attimo, controllo" prima di chiamare i tool.
      // Chiudere sul primo significava rispondere con quello, perdere i tool
      // che arrivano dopo, e lasciare il turno in corso a bloccare il
      // successivo.
      if (event.type === "message.completed") {
        if (event.data.message) parts.current.push(event.data.message);
        return;
      }

      // Il turno e' finito: ora si risponde, con tutto quello che ha detto.
      if (event.type === "turn.completed") {
        askResolver.current = null;
        const text = parts.current.join(" ").trim();
        parts.current = [];
        waiting.resolve(text);
        return;
      }

      // Un turno fallito deve arrivare al modello vocale come errore, non
      // restare appeso: altrimenti la conversazione si ferma in silenzio.
      if (event.type === "turn.failed") {
        askResolver.current = null;
        parts.current = [];
        waiting.reject(new Error(event.data.message));
      }
    },
  });

  /** Oltre questo tempo il modello vocale deve poter dire qualcosa. */
  const ASK_TIMEOUT_MS = 45_000;

  /**
   * Le domande al negozio vanno in fila indiana.
   *
   * Una sessione eve elabora un turno alla volta: se il modello vocale chiede
   * due cose ravvicinate — succede, parla mentre pensa — la seconda `send`
   * viene rifiutata con "eve session is already processing a turn". Qui ogni
   * richiesta aspetta che la precedente abbia finito, invece di fallire.
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function askConcierge(question: string): Promise<string> {
    const run = queue.current.then(
      () => runAsk(question),
      () => runAsk(question),
    );
    // La coda non deve interrompersi per una domanda andata male.
    queue.current = run.catch(() => undefined);
    return run;
  }

  function runAsk(question: string): Promise<string> {
    setThinking({ question, tools: [] });
    parts.current = [];
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (askResolver.current?.resolve !== resolve) return;
        askResolver.current = null;
        reject(new Error("Il sistema del negozio non ha risposto in tempo."));
        setThinking(null);
      }, ASK_TIMEOUT_MS);

      askResolver.current = {
        resolve: (text) => {
          clearTimeout(timer);
          setThinking(null);
          resolve(text);
        },
        reject: (error) => {
          clearTimeout(timer);
          setThinking(null);
          reject(error);
        },
      };

      // Il contesto del turno accorcia la catena: senza, l'agente prima
      // annuncia che sta per controllare, poi carica la skill, poi chiama i
      // tool — tre giri di modello per una domanda sola, che a voce sono
      // secondi di silenzio.
      agent
        .send({ message: question, clientContext: BRIDGE_CONTEXT })
        .catch((error: unknown) => {
          clearTimeout(timer);
          askResolver.current = null;
          setThinking(null);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  const model = useMemo(
    () => gateway.experimental_realtime(modelId),
    [modelId],
  );

  // La configurazione va memorizzata: un oggetto nuovo a ogni render fa
  // rientrare il hook nel proprio effetto di sincronizzazione all'infinito
  // ("Maximum update depth exceeded").
  const sessionConfig = useMemo(() => {
    const base = {
      voice,
      turnDetection: { type: "server-vad" as const },
      instructions: INSTRUCTIONS,
    };

    // La trascrizione si chiede solo ai modelli che la reggono. La doc del
    // Gateway lo dice dei Grok Voice: "supports speech-to-speech only, so it
    // does not handle transcription or translation" — e chiedergliela lo
    // faceva smettere di parlare del tutto.
    if (!modelId.startsWith("xai/grok-voice")) {
      // Il campo vuole il nome nativo del provider, non l'identificativo del
      // Gateway: "whisper-1", non "openai/whisper-1". Con il prefisso il
      // provider risponde "Invalid value" e la sessione non parte.
      const nativeTranscription =
        transcription.split("/").pop() ?? transcription;

      return {
        ...base,
        // Solo audio: il provider accetta ['text'] oppure ['audio'], mai
        // entrambe ("Invalid modalities"). Il testo per la chat arriva dalla
        // trascrizione dell'output, che e' esattamente il suo mestiere.
        outputModalities: ["audio" as const],
        // E anche quello che dici tu, altrimenti la conversazione in chat
        // risulterebbe a meta'.
        inputAudioTranscription: {
          model: nativeTranscription,
          language: "it",
        },
        outputAudioTranscription: {
          model: nativeTranscription,
          language: "it",
        },
      };
    }

    return base;
  }, [voice, transcription, modelId]);

  const realtime = useRealtime({
    model,
    sampleRate: AUDIO_SAMPLE_RATE,
    api: { token: "/api/realtime/token" },
    sessionConfig,
    async onToolCall({ toolCall }) {
      const args = toolCall.args as { domanda?: string };
      const question = args.domanda?.trim();
      if (!question) return { errore: "domanda mancante" };
      try {
        return { risposta: await askConcierge(question) };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error("[concierge] il ponte verso eve ha fallito", error);
        setNotice(detail);
        return {
          errore: `Il sistema del negozio non ha risposto: ${detail}. Dillo al cliente invece di inventare.`,
        };
      }
    },
    onEvent(event) {
      // Fra la domanda e la prima sillaba passano dei secondi: senza un segno
      // sullo schermo la conversazione sembra piantata.
      if (event.type === "response-created") setResponding(true);
      if (event.type === "response-done") {
        setResponding(false);
        setTurnsDone((count) => count + 1);
      }

      // Il hook riproduce l'audio da se': l'ampiezza per il lip sync si ricava
      // dai chunk PCM16 in arrivo, che sono lo stesso audio un istante prima
      // che si senta.
      if (event.type !== "audio-delta") return;

      // Un blocco malformato non deve zittire tutti quelli dopo.
      try {
        pushAudio(decodeRealtimeAudio(event.delta));
      } catch (error) {
        console.warn("[voce] blocco audio non decodificabile", error);
        return;
      }

      setVoiceActive(true);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      // Piu' lungo del silenzio della linea temporale: qui si spegne solo lo
      // stato "sta parlando", la bocca la chiude gia' lei.
      silenceTimer.current = setTimeout(() => setVoiceActive(false), 600);
    },
    onError(error) {
      setNotice(error.message);
    },
  });

  const { status, messages, isCapturing, isPlaying } = realtime;

  // Entrando nella pagina la sessione si apre da sola: il concierge saluta per
  // primo, come farebbe qualcuno dietro al banco.
  const session = useRef(realtime);
  session.current = realtime;

  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;

    session.current
      .connect()
      .then(() => session.current.requestResponse())
      .catch((error: unknown) => {
        setNotice(
          error instanceof Error
            ? error.message
            : "Non sono riuscito ad aprire la conversazione.",
        );
      });
  }, []);

  // A fine riproduzione la bocca torna chiusa.
  // Il conto alla rovescia del silenzio va fermato quando si lascia la pagina.
  useEffect(() => {
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  // Il microfono si spegne comunque quando si lascia la pagina.
  useEffect(() => {
    return () => {
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
      session.current.disconnect();
    };
  }, []);

  async function toggleMic() {
    if (micOn) {
      realtime.stopAudioCapture();
      resetMouth();
      // Fermare la cattura non spegne le tracce: senza questo il browser
      // resta con la spia accesa e continua a registrare.
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
      setMicStream(null);
      setMicOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStream(stream);
      realtime.startAudioCapture(stream);
      setMicOn(true);
      setNotice(null);
    } catch {
      setNotice("Il microfono e' stato negato: puoi comunque scrivere.");
    }
  }

  const chatMessages = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        role:
          message.role === "user" ? ("user" as const) : ("assistant" as const),
        parts: [
          {
            type: "text" as const,
            text: message.parts
              .filter((part) => part.type === "text")
              .map((part) => ("text" in part ? part.text : ""))
              .join(" "),
          },
        ],
      })),
    [messages],
  );

  // Sta parlando se il hook lo dice o se l'audio sta ancora arrivando: i due
  // segnali insieme coprono anche le pause fra un blocco e l'altro.
  const speakingNow = isPlaying || voiceActive;

  const avatarState = speakingNow
    ? ("speaking" as const)
    : thinking || status === "connecting"
      ? ("thinking" as const)
      : micOn && isCapturing
        ? ("listening" as const)
        : ("idle" as const);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:px-12 lg:py-8">
        <div className="relative h-60 min-h-0 overflow-hidden md:h-80 lg:h-[calc(100dvh-9.5rem)] lg:max-h-[680px]">
          <AvatarController
            events={agent.events}
            listening={avatarState === "listening"}
            speaking={avatarState === "speaking"}
            visemes={mouth}
            vrmUrl={avatarUrl}
          />
        </div>

        <div className="h-[520px] min-h-0 overflow-hidden lg:h-[calc(100dvh-9.5rem)] lg:max-h-[680px]">
          <ChatPanel
            messages={chatMessages}
            busy={status === "connecting"}
            thinking={thinking}
            responding={responding}
            error={null}
            onSend={(text) => {
              // Scrivere e parlare entrano nella stessa sessione: l'avatar
              // risponde a voce anche a un messaggio scritto.
              realtime.sendTextMessage(text);
              realtime.requestResponse();
            }}
          />
        </div>
      </div>

      {/* Niente overflow-hidden sopra: annullerebbe lo sticky di questa barra. */}
      <div className="sticky bottom-0 border-t border-outline bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-4 px-4 lg:px-12">
          {/* L'anello che si espande e' l'unico invito che c'e': senza, il
              microfono spento sembra un pulsante disattivato e nessuno lo
              preme. Sparisce appena la conversazione e' aperta, perche' a quel
              punto non serve piu' e competerebbe con l'avatar. */}
          <span className="relative flex shrink-0">
            {status === "connected" && !micOn ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-full bg-primary/30"
              />
            ) : null}

            {/* Col microfono aperto l'anello smette di invitare e comincia a
                rispondere: si allarga con la voce che entra. */}
            {micOn ? <MicLevelRing stream={micStream} /> : null}

            <Button
              type="button"
              size="icon"
              variant={micOn ? "default" : "outline"}
              className={cn(
                "relative size-14 shrink-0 rounded-full",
                micOn && !isPlaying && "ring-4 ring-ring/40",
              )}
              disabled={status !== "connected"}
              onClick={toggleMic}
              aria-label={
                micOn ? "Spegni il microfono" : "Accendi il microfono"
              }
            >
              {status === "connecting" ? (
                <Spinner className="size-5" />
              ) : (
                <HugeiconsIcon
                  icon={micOn ? Mic01Icon : MicOff01Icon}
                  size={22}
                  strokeWidth={1.8}
                />
              )}
            </Button>
          </span>

          <VoiceStatus state={avatarState} notice={notice} />

          <div className="ml-auto flex items-center gap-4">
            <CreditMeter refreshKey={turnsDone} />
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide text-on-surface-variant">
              {micOn ? "microfono acceso" : "microfono spento"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const INSTRUCTIONS = `Sei il concierge di Rifugio Sport, negozio di noleggio e vendita attrezzatura sciistica in Val di Fassa. Parli italiano, con il tono di chi sta dietro al banco: cordiale, concreto, frasi corte, una domanda alla volta.

Apri tu la conversazione con un saluto di una frase, dicendo cosa sai fare in poche parole, e chiudi invitando il cliente a dirti dove va a sciare.

Non conosci prezzi, disponibilita' ne' policy: per qualunque cosa riguardi attrezzatura, date, costi o regole del negozio usi lo strumento chiedi_al_negozio e riporti la sua risposta. Non inventare mai un numero.

Mentre aspetti lo strumento dillo — "controllo subito" — perche' il silenzio dura piu' di quanto sembri.

Se il cliente vuole un consiglio sull'attrezzatura servono quattro cose: livello, altezza, peso e stile di sciata. Le chiedi una per volta.`;
