"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AvatarState } from "@/components/avatar/AvatarState";
import { AVATAR_STATE_LABEL } from "@/components/avatar/AvatarState";

export type VoiceStatusProps = {
  state: AvatarState;
  /** Motivo per cui la voce non e' utilizzabile, se e' successo qualcosa. */
  notice?: string | null;
};

/**
 * Lo stato dell'agente, scritto.
 *
 * Il DESIGN.md e' esplicito: mai un'icona da sola, mai uno spinner anonimo.
 * Chi parla deve capire quando e' il suo turno senza interpretare un'animazione.
 */
export function VoiceStatus({ state, notice }: VoiceStatusProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        className="font-[family-name:var(--font-inter)] text-[14px] font-medium text-on-surface-variant"
        aria-live="polite"
      >
        {AVATAR_STATE_LABEL[state]}
      </span>
      {notice ? (
        <span className="flex items-center gap-1.5 text-[13px] text-alert">
          <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={1.8} />
          {notice}
        </span>
      ) : null}
    </div>
  );
}
