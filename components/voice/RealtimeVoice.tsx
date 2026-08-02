"use client";

import { gateway } from "@ai-sdk/gateway";
import { experimental_useRealtime as useRealtime } from "@ai-sdk/react";
import { Mic01Icon, MicOff01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Conversazione vocale realtime attraverso il Vercel AI Gateway.
 *
 * Un salto invece di tre: il modello sente e parla, senza passare da
 * trascrizione e sintesi separate.
 *
 * Il modello ha un solo strumento, dichiarato nella rotta del gettone: per
 * prezzi, disponibilita' e policy chiede a eve, che esegue un turno intero con
 * le sue skill e i suoi tool.
 */

export type RealtimeVoiceProps = {
  /** Identificativo Gateway, letto dal sub-agente voce via /api/realtime/token. */
  model: string;
  /** Voce del modello, definita dallo stesso sub-agente. */
  voice: string;
  /** Esegue un turno eve completo e restituisce il testo della risposta. */
  askConcierge: (question: string) => Promise<string>;
  onListeningChange: (listening: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onUnavailable: (reason: string) => void;
};

export function RealtimeVoice({
  model: modelId,
  voice,
  askConcierge,
  onListeningChange,
  onSpeakingChange,
  onUnavailable,
}: RealtimeVoiceProps) {
  const model = useMemo(
    () => gateway.experimental_realtime(modelId),
    [modelId],
  );

  const {
    status,
    isCapturing,
    isPlaying,
    connect,
    disconnect,
    startAudioCapture,
    stopAudioCapture,
  } = useRealtime({
    model,
    api: { token: "/api/realtime/token" },
    sessionConfig: {
      voice,
      turnDetection: { type: "server-vad" },
      instructions: `Sei il concierge di Rifugio Sport, negozio di noleggio e vendita attrezzatura sciistica in Val di Fassa. Parli italiano, tono da banco: cordiale, concreto, frasi corte, una domanda alla volta.

Non conosci prezzi, disponibilita' ne' policy: per qualunque cosa riguardi attrezzatura, date, costi o regole usi lo strumento chiedi_al_negozio e riporti la sua risposta. Non inventare mai un numero.

Mentre aspetti lo strumento dillo: "controllo subito".`,
    },
    async onToolCall({ toolCall }) {
      const args = toolCall.args as { domanda?: string };
      const question = args.domanda?.trim();
      if (!question) return { errore: "domanda mancante" };

      try {
        return { risposta: await askConcierge(question) };
      } catch {
        return {
          errore:
            "Il sistema del negozio non ha risposto. Dillo al cliente invece di inventare.",
        };
      }
    },
    onError(error) {
      onUnavailable(error.message);
    },
  });

  useEffect(() => {
    onListeningChange(isCapturing && !isPlaying);
  }, [isCapturing, isPlaying, onListeningChange]);

  useEffect(() => {
    onSpeakingChange(isPlaying);
  }, [isPlaying, onSpeakingChange]);

  async function start() {
    try {
      await connect();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioCapture(stream);
    } catch (error) {
      onUnavailable(
        error instanceof Error
          ? error.message
          : "Non sono riuscito ad aprire la sessione vocale.",
      );
    }
  }

  function stop() {
    stopAudioCapture();
    disconnect();
    onListeningChange(false);
    onSpeakingChange(false);
  }

  const live = status === "connected";

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="icon"
        variant={live ? "default" : "outline"}
        className={cn(
          "size-14 rounded-full",
          live && isCapturing && !isPlaying && "ring-4 ring-ring/40",
        )}
        disabled={status === "connecting"}
        onClick={live ? stop : start}
        aria-label={live ? "Chiudi la conversazione" : "Apri la conversazione"}
      >
        {status === "connecting" ? (
          <Spinner className="size-5" />
        ) : (
          <HugeiconsIcon
            icon={live ? Mic01Icon : MicOff01Icon}
            size={22}
            strokeWidth={1.8}
          />
        )}
      </Button>
      <span className="text-[13px] text-on-surface-variant">
        {live ? "conversazione aperta" : "realtime"}
      </span>
    </div>
  );
}
