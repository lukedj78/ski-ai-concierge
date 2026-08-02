/**
 * Lip sync guidato dall'ampiezza dell'audio in riproduzione.
 *
 * Non e' un riconoscimento di fonemi: dall'ampiezza RMS non si ricava quale
 * vocale sia. Quello che si ricava — e che l'occhio legge come parlato — e'
 * *quanto* e' aperta la bocca. I VRM espongono le espressioni standard
 * `aa/ih/ou/ee/oh`, e distribuire l'apertura su tre di queste con pesi diversi
 * da' un movimento credibile senza fingere una precisione che non c'e'.
 */

/** Le espressioni VRM usate per la bocca. */
export const VISEMES = ["aa", "ih", "ou"] as const;
export type Viseme = (typeof VISEMES)[number];

/** Sotto questa ampiezza la bocca sta chiusa: e' rumore di fondo. */
const NOISE_FLOOR = 0.04;

/** Sopra questa ampiezza la bocca e' gia' completamente aperta. */
const SATURATION = 0.35;

/**
 * Calcola l'ampiezza RMS da un buffer nel dominio del tempo, normalizzata fra
 * 0 e 1. Il buffer arriva da `AnalyserNode.getByteTimeDomainData`, dove 128 e'
 * il silenzio.
 */
export function rmsFromTimeDomain(buffer: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const centred = ((buffer[i] ?? 128) - 128) / 128;
    sum += centred * centred;
  }
  return Math.sqrt(sum / buffer.length);
}

/** Da ampiezza grezza ad apertura della bocca, fra 0 e 1. */
export function mouthOpening(amplitude: number): number {
  if (amplitude <= NOISE_FLOOR) return 0;
  const normalised = (amplitude - NOISE_FLOOR) / (SATURATION - NOISE_FLOOR);
  return Math.min(1, Math.max(0, normalised));
}

/**
 * I pesi dei visemi per una data apertura. La bocca larga (`aa`) domina
 * sull'apertura piena, quella stretta (`ih`) sulle aperture piccole, e `ou`
 * tiene un po' di arrotondamento a meta' strada: e' quello che evita l'effetto
 * "mandibola su e giu'".
 */
export function visemeWeights(opening: number): Record<Viseme, number> {
  return {
    aa: opening * 0.75,
    ih: opening * (1 - opening) * 1.6,
    ou: opening * 0.25,
  };
}

/**
 * Smorzamento esponenziale verso il valore obiettivo. Senza, la bocca sfarfalla
 * a ogni frame; `factor` e' quanta strada si fa in un frame.
 */
export function damp(current: number, target: number, factor = 0.35): number {
  return current + (target - current) * factor;
}
