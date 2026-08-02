"use client";

import { useEffect, useRef } from "react";

/**
 * L'anello che si irradia con la voce che entra.
 *
 * Dice due cose in un colpo solo: che il microfono e' davvero aperto, e che il
 * sistema ti sta sentendo. Un pulsante acceso dice solo la prima, e quando
 * parli e non succede niente sullo schermo si finisce a chiedersi se sia
 * partito qualcosa.
 *
 * Il livello si scrive direttamente nel nodo del DOM a ogni frame, senza
 * passare dallo stato di React: sarebbero sessanta render al secondo per
 * animare una cosa sola.
 */

/** Sotto questo livello e' rumore di fondo: l'anello resta fermo. */
const NOISE_FLOOR = 0.02;

/** Sopra questo livello l'anello e' al massimo dell'espansione. */
const SATURATION = 0.25;

export type MicLevelRingProps = {
  /** Il flusso del microfono, o `null` quando e' spento. */
  stream: MediaStream | null;
};

export function MicLevelRing({ stream }: MicLevelRingProps) {
  const ring = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ring.current;
    if (!stream || !node) return;

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    // Nessun collegamento all'uscita: si misura soltanto, non si riascolta —
    // altrimenti si sentirebbe la propria voce con mezzo secondo di ritardo.

    const buffer = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let smoothed = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(buffer);

      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centred = ((buffer[i] ?? 128) - 128) / 128;
        sum += centred * centred;
      }
      const rms = Math.sqrt(sum / buffer.length);

      const level = Math.min(
        1,
        Math.max(0, (rms - NOISE_FLOOR) / (SATURATION - NOISE_FLOOR)),
      );
      // Salita rapida e discesa lenta: e' cosi' che si legge come "voce" e non
      // come uno sfarfallio.
      smoothed = level > smoothed ? level : smoothed * 0.88 + level * 0.12;

      node.style.transform = `scale(${1 + smoothed * 0.55})`;
      node.style.opacity = `${0.12 + smoothed * 0.45}`;
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close();
      node.style.transform = "scale(1)";
      node.style.opacity = "0";
    };
  }, [stream]);

  return (
    <span
      ref={ring}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 opacity-0 transition-none"
    />
  );
}
