"use client";

import type { MessageStreamEvent } from "eve/client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar3D } from "./Avatar3D";
import type { VisemeWeights } from "./animations/lipSync";
import { AvatarCanvas } from "./AvatarCanvas";
import { AVATAR_STATE_LABEL, avatarStateFromEvents } from "./AvatarState";

export type AvatarControllerProps = {
  /** Lo stream di eventi della sessione eve. */
  events: readonly MessageStreamEvent[];
  /** Il microfono e' aperto. */
  listening?: boolean;
  /** L'audio della risposta e' in riproduzione. */
  speaking?: boolean;
  /** Ampiezza dell'audio in riproduzione, fra 0 e 1. */
  amplitude?: number;
  /**
   * Riferimento mutabile ai pesi dei visemi. E' un riferimento e non un
   * valore perche' cambia cinquanta volte al secondo: passarlo come stato
   * significherebbe altrettanti render.
   */
  visemes?: { current: VisemeWeights };
  /** URL del modello VRM, risolto dal server. */
  vrmUrl: string | null;
};

/**
 * L'unico ponte fra eve e la scena 3D.
 *
 * Sopra questo componente ci sono gli eventi dell'agente; sotto c'e' un avatar
 * che conosce quattro stati e nient'altro. Tutta la traduzione sta qui e in
 * `AvatarState.ts`.
 */
export function AvatarController({
  events,
  listening = false,
  speaking = false,
  amplitude = 0,
  visemes,
  vrmUrl,
}: AvatarControllerProps) {
  const state = useMemo(
    () => avatarStateFromEvents(events, { listening, speaking }),
    [events, listening, speaking],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-surface">
      {/* Il gradiente radiale freddo stacca la figura dal fondo: e' l'unica
          decorazione ammessa dal DESIGN.md attorno all'avatar. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 25%, color-mix(in oklab, var(--accent) 70%, transparent), transparent 70%)",
        }}
      />
      {/*
        Il canvas sta in posizione assoluta, non nel flusso.
        Non e' un vezzo: un canvas WebGL nel flusso si dimensiona sul
        contenitore, il contenitore si dimensiona sul contenuto, e a ogni frame
        crescono entrambi — misurato in un caso a 108.589 pixel di altezza.
        In assoluto puo' solo *leggere* la dimensione del genitore, mai
        imporgliela.
      */}
      <div className="absolute inset-0">
        <AvatarCanvas>
          <Avatar3D
            state={state}
            amplitude={amplitude}
            visemes={visemes}
            vrmUrl={vrmUrl}
          />
        </AvatarCanvas>
      </div>
      <Badge
        variant="secondary"
        className="absolute bottom-3 left-3 font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide"
      >
        {AVATAR_STATE_LABEL[state]}
      </Badge>
    </div>
  );
}
