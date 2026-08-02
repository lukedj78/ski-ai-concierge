"use client";

import { Component, type ReactNode } from "react";

/**
 * Se il modello 3D non si carica — file mancante, CDN irraggiungibile, GLB
 * corrotto, rete del cliente che blocca il dominio — l'avatar torna alla
 * figura disegnata in geometria.
 *
 * Senza questa rete, l'errore del loader risale fino a `app/error.tsx` e la
 * pagina intera diventa un messaggio di errore: un asset decorativo che non
 * arriva non deve portarsi via la conversazione.
 *
 * E' una classe perche' React non ha ancora un equivalente a `componentDidCatch`
 * negli hook: e' l'unico punto del progetto dove serve.
 */
export class AvatarFallbackBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(
      "Avatar: modello non caricato, si usa la figura di riserva.",
      error,
    );
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
