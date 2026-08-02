"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Quanto costa questa conversazione, e quanto resta nel portafoglio.
 *
 * La spesa della sessione si ricava per differenza: si legge il totale speso
 * all'apertura e lo si sottrae a quello corrente. Non e' una fattura, e'
 * l'ordine di grandezza — abbastanza per sapere se una demo costa centesimi o
 * euro, e per accorgersi che il credito sta finendo prima che finisca.
 *
 * Il consumo viene registrato dal Gateway in modo asincrono, quindi il numero
 * puo' restare indietro di qualche secondo rispetto all'ultima risposta.
 */

/** Sotto questa soglia il saldo diventa un avviso. */
const LOW_BALANCE = 2;

export type CreditMeterProps = {
  /** Cambia a ogni turno concluso: fa rileggere il saldo. */
  refreshKey: number;
};

export function CreditMeter({ refreshKey }: CreditMeterProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [spent, setSpent] = useState(0);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/credits");
        if (!response.ok) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const data = (await response.json()) as {
          balance: number;
          totalUsed: number;
        };
        if (cancelled) return;

        setBalance(data.balance);
        setBaseline((current) => {
          const start = current ?? data.totalUsed;
          setSpent(Math.max(0, data.totalUsed - start));
          return start;
        });
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (unavailable || balance === null) return null;

  const low = balance < LOW_BALANCE;

  return (
    <span
      className={cn(
        "font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide",
        low ? "text-alert" : "text-on-surface-variant",
      )}
      title={
        low
          ? "Il credito del Gateway sta finendo."
          : "Spesa di questa conversazione e saldo residuo del Gateway."
      }
    >
      <AnimatedUsd value={spent} /> · saldo <AnimatedUsd value={balance} />
    </span>
  );
}

/**
 * Una cifra che scorre fino al nuovo valore invece di saltarci.
 *
 * Il salto e' breve — mezzo secondo — e serve a farsi notare: in una
 * conversazione a voce nessuno guarda la barra in basso, e un numero che si
 * muove per un attimo dice "e' appena successo qualcosa".
 *
 * Non e' un contatore in tempo reale, e non deve sembrarlo: il consumo il
 * Gateway lo registra a scatti, quindi qui si interpola solo fra due letture
 * vere.
 */
function AnimatedUsd({ value }: { value: number }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const element = node.current;
    if (!element) return;

    const from = shown.current;
    const delta = value - from;
    if (Math.abs(delta) < 0.0001) {
      element.textContent = formatUsd(value);
      return;
    }

    const DURATION = 500;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      // Decelerazione: parte svelta e si posa, invece di fermarsi di colpo.
      const eased = 1 - (1 - progress) ** 3;
      const current = from + delta * eased;
      shown.current = current;
      element.textContent = formatUsd(current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  // `tabular-nums`: senza, le cifre hanno larghezze diverse e il numero balla
  // mentre scorre.
  return (
    <span ref={node} className="tabular-nums">
      {formatUsd(value)}
    </span>
  );
}

/** Sotto il centesimo si scrive comunque una cifra leggibile, non "0.00". */
function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}
