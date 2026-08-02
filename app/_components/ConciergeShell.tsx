"use client";

import { useEveAgent } from "eve/react";
import { useMemo, useRef, useState } from "react";
import { AvatarController } from "@/components/avatar/AvatarController";
import { avatarStateFromEvents } from "@/components/avatar/AvatarState";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VoiceButton } from "@/components/voice/VoiceButton";
import { VoiceStatus } from "@/components/voice/VoiceStatus";
import {
  takeCompleteSentences,
  toSpeakable,
  useSpokenReply,
} from "@/components/voice/useSpokenReply";

/**
 * Il contesto che marca un turno come parlato.
 *
 * Viaggia come `clientContext`: e' effimero, non finisce nella storia durevole
 * della sessione, e serve solo all'agente per sapere che deve delegare la resa
 * al sub-agente `voice`.
 */
const VOICE_TURN_CONTEXT =
  "Questo turno arriva dal microfono: la risposta verra' letta ad alta voce.";

export type ConciergeShellProps = {
  /** URL del VRM risolto dal server, o `null` se non c'e' nessun modello. */
  vrmUrl: string | null;
};

/**
 * Tiene insieme le tre parti della schermata: avatar, conversazione, voce.
 *
 * E' l'unico componente che parla con eve, e lo fa solo attraverso
 * `useEveAgent`. Non importa `ai`, non conosce nessun identificativo di
 * modello, non tocca il database.
 */
export function ConciergeShell({ vrmUrl }: ConciergeShellProps) {
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const { amplitude, speaking, enqueue, reset } = useSpokenReply();

  // Quanto del testo in arrivo e' gia' stato accodato, e la coda di frase
  // ancora incompleta.
  const cursor = useRef(0);
  const pending = useRef("");

  // Segna il turno in corso come parlato: la risposta andra' letta.
  const spokenTurn = useRef(false);

  // Leggere ad alta voce ogni risposta, non solo quelle nate dal microfono.
  // Acceso di default: e' quello che ci si aspetta da un concierge parlante, e
  // in una demo la differenza fra "sa parlare" e "parla" e' tutta qui.
  const [readAloud, setReadAloud] = useState(true);

  const agent = useEveAgent({
    onEvent(event) {
      const shouldSpeak = spokenTurn.current || readAloud;

      if (event.type === "turn.started") {
        cursor.current = 0;
        pending.current = "";
        reset();
        return;
      }

      // La voce insegue il testo mentre scorre, frase per frase: la prima si
      // sente mentre l'ultima non e' ancora stata scritta. Sintetizzare tutta
      // la risposta a turno finito voleva dire aspettare due volte — prima il
      // testo, poi la sintesi — con lo scritto gia' fermo sullo schermo.
      if (event.type === "message.appended") {
        if (!shouldSpeak) return;
        const soFar = event.data.messageSoFar;
        const fresh = soFar.slice(cursor.current);
        cursor.current = soFar.length;

        const { sentences, rest } = takeCompleteSentences(
          pending.current + fresh,
        );
        pending.current = rest;
        for (const sentence of sentences) {
          enqueue(toSpeakable(sentence), setVoiceNotice);
        }
        return;
      }

      // Quello che resta nel buffer a fine blocco: l'ultima frase spesso non
      // ha punteggiatura finale seguita da spazio.
      if (event.type === "message.completed") {
        if (!shouldSpeak) return;
        const tail = pending.current.trim();
        pending.current = "";
        cursor.current = 0;
        if (tail) enqueue(toSpeakable(tail), setVoiceNotice);
      }
    },
    onFinish() {
      spokenTurn.current = false;
    },
    onError() {
      spokenTurn.current = false;
    },
  });

  const busy = agent.status === "submitted" || agent.status === "streaming";

  const avatarState = useMemo(
    () => avatarStateFromEvents(agent.events, { listening, speaking }),
    [agent.events, listening, speaking],
  );

  function sendTyped(text: string) {
    spokenTurn.current = false;
    void agent.send({ message: text });
  }

  function sendSpoken(text: string) {
    spokenTurn.current = true;
    setVoiceNotice(null);
    void agent.send({ message: text, clientContext: VOICE_TURN_CONTEXT });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/*
        Le due colonne hanno un'altezza definita a ogni breakpoint, mai `auto`.
        Un canvas 3D dentro un contenitore che si dimensiona sul contenuto
        entra in una spirale: misura, cresce, rimisura — e la pagina scrolla
        all'infinito con l'avatar gigante. L'altezza su desktop e' il viewport
        meno intestazione, barra voce e margini.

        `minmax(0, …)` invece di `2fr_3fr` secchi: senza, il canvas 3D impone la
        propria larghezza minima e si prende due terzi della riga, schiacciando
        la chat contro il bordo.
      */}
      <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 gap-6 px-4 py-6  lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:px-12 lg:py-8">
        <div className="relative h-60 min-h-0 overflow-hidden md:h-80 lg:h-[calc(100dvh-9.5rem)] lg:max-h-[680px]">
          <AvatarController
            events={agent.events}
            listening={listening}
            speaking={speaking}
            amplitude={amplitude}
            vrmUrl={vrmUrl}
          />
        </div>

        <div className="h-[520px] min-h-0 overflow-hidden lg:h-[calc(100dvh-9.5rem)] lg:max-h-[680px]">
          <ChatPanel
            messages={agent.data.messages}
            busy={busy}
            error={agent.error}
            onSend={sendTyped}
          />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-outline bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-center gap-4 px-4 lg:px-12">
          <VoiceButton
            onTranscript={sendSpoken}
            onListeningChange={setListening}
            onUnavailable={setVoiceNotice}
            disabled={busy}
          />
          <VoiceStatus state={avatarState} notice={voiceNotice} />

          <Label
            htmlFor="read-aloud"
            className="ml-auto flex cursor-pointer items-center gap-2 text-[14px] text-on-surface-variant"
          >
            <Switch
              id="read-aloud"
              checked={readAloud}
              onCheckedChange={setReadAloud}
            />
            Leggi le risposte
          </Label>
        </div>
      </div>
    </div>
  );
}
