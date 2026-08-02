import Link from "next/link";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/concierge", label: "Concierge" },
  { href: "/showcase", label: "Design system" },
];

/**
 * L'intestazione: nome del negozio a sinistra, stato a destra.
 *
 * Non e' un sito, e' una schermata: niente menu di navigazione gonfiato, niente
 * hamburger. Sotto `sm` restano marchio e comandi.
 */
export function SiteTopNav({ status }: { status?: string }) {
  return (
    <header className="border-b border-outline bg-surface">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-4 lg:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold text-primary-foreground">
            R
          </span>
          <span className="text-[14px] font-semibold">Rifugio Sport</span>
        </Link>

        <nav className="hidden items-center gap-5 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[14px] text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {status ? (
            <Badge
              variant="secondary"
              className="hidden font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide sm:inline-flex"
            >
              {status}
            </Badge>
          ) : null}
          <ModeToggle />
          {/* `nativeButton={false}`: il render e' un <a>, e senza questo Base UI
              avverte che sta perdendo la semantica nativa di <button>. */}
          <Button
            size="sm"
            className="h-9"
            nativeButton={false}
            render={<Link href="/concierge" />}
          >
            Parla col concierge
          </Button>
        </div>
      </div>
    </header>
  );
}
