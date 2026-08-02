/**
 * Lip sync per formanti.
 *
 * Dall'ampiezza si ricava solo *quanto* e' aperta la bocca, e il risultato e'
 * una mandibola che va su e giu'. Per capire *quale* vocale sta pronunciando
 * servono le formanti: i due picchi di risonanza del tratto vocale, F1 e F2,
 * che nello spettro distinguono una A da una I anche a volume identico.
 *
 * La procedura, sui campioni PCM che arrivano dalla sessione vocale:
 *   1. finestra di Hann, per non sporcare lo spettro ai bordi del blocco
 *   2. FFT, da cui lo spettro di ampiezza
 *   3. F1 = picco fra 250 e 900 Hz, F2 = picco fra 900 e 2800 Hz
 *   4. la coppia (F1, F2) si confronta con le cinque vocali italiane e i pesi
 *      escono per distanza inversa
 *
 * Non e' un riconoscitore di fonemi: le consonanti non le distingue. Ma una A
 * aperta, una I stretta e una O arrotondata si vedono, ed e' quello che
 * l'occhio legge come parlato.
 */

/** Le espressioni VRM per la bocca, che coincidono con i visemi Oculus. */
export const VISEMES = ["aa", "ih", "ou", "ee", "oh"] as const;
export type Viseme = (typeof VISEMES)[number];
export type VisemeWeights = Record<Viseme, number>;

/** Tutti a zero: bocca chiusa. */
export const CLOSED_MOUTH: VisemeWeights = {
  aa: 0,
  ih: 0,
  ou: 0,
  ee: 0,
  oh: 0,
};

/**
 * Sotto questa ampiezza la bocca sta chiusa: e' rumore di fondo.
 *
 * Tarata sui chunk PCM16 di una sessione realtime, dove l'RMS del parlato sta
 * fra 0.02 e 0.15 — non su un mp3 gia' normalizzato, dove sarebbe il triplo.
 */
const NOISE_FLOOR = 0.012;

/** Sopra questa ampiezza la bocca e' gia' completamente aperta. */
const SATURATION = 0.13;

/**
 * Le cinque vocali italiane in coordinate (F1, F2), in hertz.
 *
 * Sono i valori medi di un parlante adulto. Servono da riferimento: la vocale
 * riconosciuta e' quella con le formanti piu' vicine a quelle misurate.
 */
const VOWEL_FORMANTS: Record<Viseme, [f1: number, f2: number]> = {
  aa: [800, 1200], // "a" di casa
  ee: [500, 2000], // "e" di bene
  ih: [300, 2400], // "i" di vino
  oh: [500, 900], // "o" di sole
  ou: [320, 800], // "u" di luna
};

/** Ampiezza RMS di un blocco di campioni, fra 0 e 1. */
export function rmsFromSamples(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/**
 * Ampiezza RMS da un buffer nel dominio del tempo di un `AnalyserNode`, dove
 * 128 e' il silenzio.
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
 * FFT iterativa radix-2, in place, su parte reale e immaginaria.
 *
 * Scritta a mano perche' e' venti righe e l'alternativa era una dipendenza per
 * una trasformata su blocchi da 512 campioni.
 */
function fft(real: Float32Array, imaginary: Float32Array): void {
  const n = real.length;

  // Riordino bit-reversed.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j] as number, real[i] as number];
      [imaginary[i], imaginary[j]] = [
        imaginary[j] as number,
        imaginary[i] as number,
      ];
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const wReal = Math.cos(angle);
    const wImaginary = Math.sin(angle);

    for (let i = 0; i < n; i += length) {
      let currentReal = 1;
      let currentImaginary = 0;

      for (let j = 0; j < length / 2; j += 1) {
        const uReal = real[i + j] as number;
        const uImaginary = imaginary[i + j] as number;
        const vReal =
          (real[i + j + length / 2] as number) * currentReal -
          (imaginary[i + j + length / 2] as number) * currentImaginary;
        const vImaginary =
          (real[i + j + length / 2] as number) * currentImaginary +
          (imaginary[i + j + length / 2] as number) * currentReal;

        real[i + j] = uReal + vReal;
        imaginary[i + j] = uImaginary + vImaginary;
        real[i + j + length / 2] = uReal - vReal;
        imaginary[i + j + length / 2] = uImaginary - vImaginary;

        const nextReal = currentReal * wReal - currentImaginary * wImaginary;
        currentImaginary = currentReal * wImaginary + currentImaginary * wReal;
        currentReal = nextReal;
      }
    }
  }
}

/** La potenza di due che sta sotto o uguale a `value`, minimo 256. */
function previousPowerOfTwo(value: number): number {
  let size = 256;
  while (size * 2 <= value) size *= 2;
  return size;
}

/** Frequenza del picco di ampiezza in una banda, in hertz. */
function peakFrequency(
  spectrum: Float32Array,
  sampleRate: number,
  fromHz: number,
  toHz: number,
): number {
  const binHz = sampleRate / (spectrum.length * 2);
  const first = Math.max(1, Math.floor(fromHz / binHz));
  const last = Math.min(spectrum.length - 1, Math.ceil(toHz / binHz));

  let bestBin = first;
  let best = -1;
  for (let bin = first; bin <= last; bin += 1) {
    const magnitude = spectrum[bin] as number;
    if (magnitude > best) {
      best = magnitude;
      bestBin = bin;
    }
  }
  return bestBin * binHz;
}

/**
 * Dai campioni ai pesi dei visemi.
 *
 * Ritorna anche l'apertura complessiva: i pesi dicono *quale* vocale, la
 * apertura dice *quanto* — una A urlata e una A sussurrata hanno le stesse
 * formanti.
 */
export function visemesFromSamples(
  samples: Float32Array,
  sampleRate: number,
): { weights: VisemeWeights; opening: number } {
  const opening = mouthOpening(rmsFromSamples(samples));
  if (opening === 0) return { weights: { ...CLOSED_MOUTH }, opening: 0 };

  const size = previousPowerOfTwo(samples.length);
  const real = new Float32Array(size);
  const imaginary = new Float32Array(size);

  // Finestra di Hann: senza, i bordi del blocco introducono frequenze che non
  // ci sono e le formanti si spostano.
  for (let i = 0; i < size; i += 1) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    real[i] = (samples[i] ?? 0) * window;
  }

  fft(real, imaginary);

  const spectrum = new Float32Array(size / 2);
  for (let bin = 0; bin < size / 2; bin += 1) {
    spectrum[bin] = Math.hypot(real[bin] as number, imaginary[bin] as number);
  }

  const f1 = peakFrequency(spectrum, sampleRate, 250, 900);
  const f2 = peakFrequency(spectrum, sampleRate, 900, 2800);

  // Distanza inversa dalle cinque vocali di riferimento. Le formanti si
  // confrontano in scala logaritmica perche' l'orecchio — e la fonetica —
  // ragionano per rapporti, non per differenze in hertz.
  const weights = { ...CLOSED_MOUTH };
  let total = 0;
  for (const viseme of VISEMES) {
    const [refF1, refF2] = VOWEL_FORMANTS[viseme];
    const distance = Math.hypot(
      Math.log2(f1 / refF1),
      Math.log2(f2 / refF2) * 0.8,
    );
    const weight = 1 / (0.08 + distance * distance);
    weights[viseme] = weight;
    total += weight;
  }

  // Normalizzati sull'apertura: la somma dei visemi vale quanto la bocca e'
  // aperta, cosi' non si sommano fino a deformare il viso.
  for (const viseme of VISEMES) {
    weights[viseme] = (weights[viseme] / total) * opening;
  }

  return { weights, opening };
}

/**
 * Smorzamento esponenziale verso il valore obiettivo. Senza, la bocca
 * sfarfalla a ogni frame; `factor` e' quanta strada si fa in un frame.
 */
export function damp(current: number, target: number, factor = 0.35): number {
  return current + (target - current) * factor;
}

/** Smorza tutti i visemi insieme. */
export function dampWeights(
  current: VisemeWeights,
  target: VisemeWeights,
  factor = 0.4,
): VisemeWeights {
  const next = { ...CLOSED_MOUTH };
  for (const viseme of VISEMES) {
    next[viseme] = damp(current[viseme], target[viseme], factor);
  }
  return next;
}
