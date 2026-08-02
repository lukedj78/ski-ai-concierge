"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  CLOSED_MOUTH,
  type VisemeWeights,
  visemesFromSamples,
} from "./lipSync";

/**
 * La linea temporale dei visemi.
 *
 * Il problema che risolve: i blocchi audio **arrivano** molto prima di quando
 * si **sentono**. Il player ne accumula qualche decimo di secondo prima di
 * cominciare, e poi li consuma al ritmo reale. Analizzarli al momento
 * dell'arrivo produce una bocca che parte in anticipo, si muove a raffica e
 * poi resta ferma perche' ha gia' consumato tutto il materiale.
 *
 * Qui ogni blocco entra in coda con la propria **durata** — numero di campioni
 * diviso frequenza di campionamento — e un ciclo a ogni frame avanza sulla
 * coda al ritmo dell'orologio. La bocca segue il tempo dell'audio, non quello
 * della rete.
 */

/**
 * Quanto audio accumula il player prima di iniziare, in millisecondi.
 *
 * E' il ritardo con cui la bocca deve partire rispetto all'arrivo del primo
 * blocco. Stimato: un valore troppo basso anticipa il labiale, troppo alto lo
 * ritarda. Con 180 ms il movimento cade dentro la sillaba.
 */
const PLAYBACK_LATENCY_MS = 180;

/** Dopo tanto silenzio la bocca si chiude. */
const SILENCE_MS = 250;

export function useVisemeTimeline(sampleRate: number) {
  /** I pesi che la scena 3D legge a ogni frame. */
  const mouth = useRef<VisemeWeights>({ ...CLOSED_MOUTH });

  const queue = useRef<{ weights: VisemeWeights; durationMs: number }[]>([]);
  /** Quando deve iniziare il blocco in testa alla coda. */
  const frameStart = useRef<number | null>(null);
  const lastPush = useRef(0);

  /** Accoda un blocco di campioni PCM appena arrivato. */
  const push = useCallback(
    (samples: Float32Array) => {
      const { weights } = visemesFromSamples(samples, sampleRate);
      queue.current.push({
        weights,
        durationMs: (samples.length / sampleRate) * 1000,
      });
      lastPush.current = performance.now();
      // Il primo blocco fissa l'inizio della riproduzione, con il ritardo del
      // buffer del player.
      frameStart.current ??= performance.now() + PLAYBACK_LATENCY_MS;
    },
    [sampleRate],
  );

  const reset = useCallback(() => {
    queue.current = [];
    frameStart.current = null;
    mouth.current = { ...CLOSED_MOUTH };
  }, []);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();

      // Si scartano i blocchi il cui tempo e' gia' passato, finche' quello in
      // testa non e' quello che si sta sentendo adesso.
      while (queue.current.length > 0 && frameStart.current !== null) {
        const head = queue.current[0];
        if (!head) break;
        if (now < frameStart.current + head.durationMs) break;
        frameStart.current += head.durationMs;
        queue.current.shift();
      }

      const head = queue.current[0];
      if (head && frameStart.current !== null && now >= frameStart.current) {
        mouth.current = head.weights;
        return;
      }

      // Coda vuota da un po': la voce ha finito.
      if (now - lastPush.current > SILENCE_MS) {
        mouth.current = { ...CLOSED_MOUTH };
        frameStart.current = null;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return { mouth, push, reset };
}
