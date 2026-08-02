"use client";

import { useEffect, useState } from "react";
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
      {formatUsd(spent)} · saldo {formatUsd(balance)}
    </span>
  );
}

/** Sotto il centesimo si scrive comunque una cifra leggibile, non "0.00". */
function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}
