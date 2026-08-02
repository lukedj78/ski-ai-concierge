"use client";

import { SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  // Il testo in corso di scrittura e' stato locale onesto: non deriva da
  // niente, non sta nell'URL, non serve a nessun altro componente.
  const [draft, setDraft] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft("");
    onSend(text);
  }

  return (
    <form
      className="flex items-end gap-2 border-t border-outline p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Invio manda, Maiusc+Invio va a capo: e' quello che si aspetta
          // chiunque abbia usato una chat.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Scrivi al concierge — per esempio: vado in Val di Fassa a febbraio, cosa mi serve?"
        rows={2}
        disabled={disabled}
        className="max-h-40 min-h-11 resize-none"
        aria-label="Messaggio per il concierge"
      />
      <Button
        type="submit"
        size="icon"
        className="size-11 shrink-0"
        disabled={disabled || draft.trim().length === 0}
        aria-label="Invia il messaggio"
      >
        <HugeiconsIcon icon={SentIcon} size={18} strokeWidth={1.8} />
      </Button>
    </form>
  );
}
