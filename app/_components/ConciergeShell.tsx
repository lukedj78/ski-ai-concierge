"use client";

import { useEveAgent } from "eve/react";
import { useMemo, useRef, useState } from "react";
import { AvatarController } from "@/components/avatar/AvatarController";
import { avatarStateFromEvents } from "@/components/avatar/AvatarState";
import { ChatPanel } from "@/components/chat/ChatPanel";
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

  const { amplitude, play } = useVoicePlayback();

  // Segna il turno in corso come parlato: la risposta andra' letta.
  const spokenTurn = useRef(false);

  const agent = useEveAgent({
    onFinish(snapshot) {
      if (!spokenTurn.current) return;
      spokenTurn.current = false;

      const last = snapshot.data.messages.at(-1);
      if (last?.role !== "assistant") return;

      const text = last.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ")
        .trim();
      if (!text) return;

      void speak(text);
    },
    onError() {
      spokenTurn.current = false;
    },
  });

  async function speak(text: string) {
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
    () => avatarStateFromEvents(agent.events, { listening }),
    [agent.events, listening],
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
      <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 gap-6 px-4 py-6 lg:h-[calc(100dvh-8rem)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:px-12 lg:py-8">
        <div className="h-60 min-h-0 md:h-80 lg:h-full">
          <AvatarController
            events={agent.events}
            listening={listening}
            amplitude={amplitude}
            vrmUrl={vrmUrl}
          />
        </div>

        <div className="h-[520px] min-h-0 lg:h-full">
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
        </div>
      </div>
    </div>
  );
}
