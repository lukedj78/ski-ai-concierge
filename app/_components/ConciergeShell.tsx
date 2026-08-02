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
import { useVoicePlayback } from "@/components/voice/useVoicePlayback";

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

  const { amplitude, speaking, play } = useVoicePlayback();

  // Segna il turno in corso come parlato: la risposta andra' letta.
  const spokenTurn = useRef(false);

  // Leggere ad alta voce ogni risposta, non solo quelle nate dal microfono.
  // Acceso di default: e' quello che ci si aspetta da un concierge parlante, e
  // in una demo la differenza fra "sa parlare" e "parla" e' tutta qui.
  const [readAloud, setReadAloud] = useState(true);

  // Evita di leggere due volte lo stesso blocco: `message.completed` puo'
  // arrivare piu' di una volta per turno, quando il modello parla prima di
  // chiamare un tool.
  const spokenTurnId = useRef<string | null>(null);

  const agent = useEveAgent({
    onEvent(event) {
      if (event.type === "turn.started") {
        spokenTurnId.current = null;
        return;
      }

      // La sintesi parte al primo blocco di risposta completo, non a fine
      // turno: aspettare `turn.completed` significa aspettare anche la coda
      // di eventi che segue, e sono secondi di silenzio in piu'.
      if (event.type !== "message.completed") return;
      if (!spokenTurn.current && !readAloud) return;
      if (spokenTurnId.current === event.data.turnId) return;

      const text = event.data.message?.trim();
      if (!text) return;

      spokenTurnId.current = event.data.turnId;
      void speak(text);
    },
    onFinish() {
      spokenTurn.current = false;
    },
    onError() {
      spokenTurn.current = false;
    },
  });

  // Una sola sintesi alla volta. In sviluppo React monta i componenti due
  // volte e la stessa risposta partirebbe in doppio, con il secondo audio che
  // interrompe il primo a meta' frase.
  const lastSpokenText = useRef<string | null>(null);

  async function speak(text: string) {
    if (lastSpokenText.current === text) return;
    lastSpokenText.current = text;

    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setVoiceNotice(
          payload.message ?? "La risposta parlata non e' disponibile.",
        );
        return;
      }

      setVoiceNotice(null);
      await play(payload.audio as string, payload.mediaType as string);
    } catch {
      setVoiceNotice("La risposta parlata non e' disponibile.");
    }
  }

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
