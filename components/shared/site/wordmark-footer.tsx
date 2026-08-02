import Link from "next/link";

/**
 * Il footer del design system.
 *
 * Il DESIGN.md non specifica un footer, quindi vale il pattern predefinito: il
 * marchio in minuscolo, grande abbastanza da *essere* il footer invece di
 * decorarlo, e sotto la riga monospazio con la firma di provenienza.
 */
export function WordmarkFooter() {
  return (
    <footer className="border-t border-outline bg-accent">
      <div className="mx-auto max-w-[1280px] space-y-10 px-4 pt-16 pb-10 lg:px-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-[42ch] space-y-2">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide text-on-surface-variant">
              Rifugio Sport
            </p>
            <p className="text-[15px] text-on-surface-variant">
              Noleggio e vendita attrezzatura sciistica in Val di Fassa. Il
              concierge porta online la consulenza del banco, non il modulo di
              prenotazione.
            </p>
          </div>

          <div className="flex gap-12">
            <FooterColumn
              title="Prodotto"
              links={[{ href: "/concierge", label: "Concierge" }]}
            />
            <FooterColumn
              title="Progetto"
              links={[
                {
                  href: "https://github.com/lukedj78/ski-ai-concierge",
                  label: "Repository",
                },
              ]}
            />
          </div>
        </div>

        <p
          className="font-[family-name:var(--font-space-grotesk)] font-semibold text-primary"
          style={{
            fontSize: "clamp(72px, 16vw, 200px)",
            lineHeight: 0.85,
            letterSpacing: "-0.04em",
          }}
        >
          ski concierge
        </p>

        <div className="flex flex-col gap-2 border-t border-outline pt-6 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-wide text-on-surface-variant sm:flex-row sm:justify-between">
          <span>© 2026 Rifugio Sport · Val di Fassa, Trentino</span>
          <span>
            Generato da design-md-to-app a partire da .workflow/DESIGN.md
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide text-on-surface-variant">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[14px] transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
