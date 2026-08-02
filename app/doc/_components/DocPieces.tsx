import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * I pezzi ricorrenti della documentazione.
 *
 * Stanno qui e non nella pagina perche' la pagina e' gia' lunga: separare la
 * forma dal contenuto rende leggibile entrambi.
 */

export function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-outline">
      <div className="mx-auto max-w-[860px] space-y-6 px-4 py-14 lg:px-12">
        <div className="space-y-2">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide text-on-surface-variant">
            {eyebrow}
          </p>
          <h2
            className="font-[family-name:var(--font-space-grotesk)] font-semibold"
            style={{
              fontSize: "32px",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
        </div>
        <div className="space-y-4 text-[16px] leading-[1.65] text-on-surface">
          {children}
        </div>
      </div>
    </section>
  );
}

/** Un blocco di codice o di struttura ad albero. */
export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-outline bg-surface-variant p-4 font-[family-name:var(--font-jetbrains-mono)] text-[12.5px] leading-[1.6]">
      <code>{children}</code>
    </pre>
  );
}

/** Un termine tecnico dentro il testo. */
export function T({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-surface-variant px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[13px]">
      {children}
    </code>
  );
}

/** Una tabella con intestazione. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="border-b border-outline">
            {head.map((cell) => (
              <th
                key={cell}
                className="py-2 pr-4 text-left font-[family-name:var(--font-jetbrains-mono)] text-[12px] font-medium uppercase tracking-wide text-on-surface-variant"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              // Le righe non hanno un id: l'indice va bene, l'elenco e' statico.
              key={`row-${rowIndex}`}
              className="border-b border-outline last:border-0 align-top"
            >
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`} className="py-3 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Una nota che merita di staccare dal testo. */
export function Note({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border-l-2 py-3 pl-4 text-[15px]",
        tone === "warning"
          ? "border-alert bg-surface-variant"
          : "border-primary bg-accent",
      )}
    >
      {children}
    </div>
  );
}
