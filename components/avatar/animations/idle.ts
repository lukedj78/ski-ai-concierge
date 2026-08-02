import type { AvatarState } from "../AvatarState";

/**
 * Il movimento di riposo.
 *
 * Un avatar perfettamente fermo sembra rotto, non calmo. Qui c'e' il minimo
 * che serve a farlo sembrare vivo: un respiro lento e una deriva della testa
 * che non ripete mai lo stesso ciclo, perche' due seni con periodi diversi non
 * tornano in fase.
 */
export type IdleMotion = {
  /** Oscillazione verticale del busto, in unita' di scena. */
  breath: number;
  /** Rotazione della testa attorno all'asse Y, in radianti. */
  headYaw: number;
  /** Rotazione della testa attorno all'asse X, in radianti. */
  headPitch: number;
};

const INTENSITY: Record<AvatarState, number> = {
  // Mentre parla il respiro si vede meno: se ne occupa la bocca.
  speaking: 0.4,
  // Mentre ascolta e' immobile e attento: e' il segnale che sta ricevendo.
  listening: 0.5,
  // Mentre pensa la testa si muove un po' di piu'.
  thinking: 1.2,
  idle: 1,
};

export function idleMotion(time: number, state: AvatarState): IdleMotion {
  const intensity = INTENSITY[state];

  return {
    breath: Math.sin(time * 1.1) * 0.008 * intensity,
    headYaw:
      (Math.sin(time * 0.37) * 0.05 + Math.sin(time * 0.83) * 0.02) * intensity,
    headPitch: Math.sin(time * 0.51) * 0.03 * intensity,
  };
}
