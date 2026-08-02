"use client";

import type { EveMessage } from "eve/client";
import { SkiIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export type ChatPanelProps = {
  messages: readonly EveMessage[];
  busy: boolean;
  /** Cosa sta facendo il negozio mentre il cliente aspetta. */
  thinking?: { question: string; tools: string[] } | null;
  error?: Error | null;
  onSend: (text: string) => void;
};

/**
 * La colonna della conversazione.
 *
 * Non conosce eve: riceve messaggi e stato, restituisce testo scritto. Chi la
 * usa decide da dove arrivano — dalla tastiera o dal microfono.
 */
export function ChatPanel({
  messages,
  busy,
  thinking,
  error,
  onSend,
}: ChatPanelProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden p-0">
      {messages.length === 0 && !thinking ? (
        <EmptyState />
      ) : (
        <MessageList messages={messages} busy={busy} thinking={thinking} />
      )}

      {error ? (
        <Alert variant="destructive" className="m-3 w-auto">
          <AlertTitle>La conversazione si e' interrotta</AlertTitle>
          <AlertDescription>
            {/* Il messaggio dell'errore resta fuori: puo' contenere dettagli
                interni. Quello che serve al cliente e' cosa fare adesso. */}
            Riprova a scrivere: se succede di nuovo, e' un problema nostro.
          </AlertDescription>
        </Alert>
      ) : null}

      <ChatInput onSend={onSend} disabled={busy} />
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <HugeiconsIcon
        icon={SkiIcon}
        size={40}
        strokeWidth={1.4}
        className="text-on-surface-variant"
      />
      <div className="space-y-2">
        <p
          className="font-[family-name:var(--font-space-grotesk)] text-[22px] font-semibold"
          style={{ letterSpacing: "-0.01em" }}
        >
          Dimmi dove vai e che sciatore sei.
        </p>
        <p className="max-w-[46ch] text-[15px] text-on-surface-variant">
          Ti chiedo quattro cose — livello, altezza, peso, dove scii — e ti dico
          cosa prendere, se c'e' per le tue date e quanto costa.
        </p>
      </div>
    </div>
  );
}
