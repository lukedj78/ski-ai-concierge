import { SkiIcon, SnowIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { SiteTopNav } from "@/components/shared/site/site-top-nav";
import { WordmarkFooter } from "@/components/shared/site/wordmark-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PROMISES = [
  {
    icon: SkiIcon,
    title: "Il consiglio del banco",
    body: "Quattro domande — livello, altezza, peso, stile — e ti diciamo che sci prendere e di che lunghezza. Non un modulo da compilare.",
  },
  {
    icon: SnowIcon,
    title: "Disponibilita' vera",
    body: "Quello che vedi e' quello che c'e' in magazzino per le tue date. Nessun «dovrebbe esserci».",
  },
  {
    icon: SparklesIcon,
    title: "A voce, come al telefono",
    body: "Parli e ti risponde. Se preferisci scrivere, scrivi: la conversazione e' la stessa.",
  },
];

export default function Home() {
  return (
    <>
      <SiteTopNav />
      <main className="flex-1 bg-background">
        <section className="border-b border-outline">
          <div className="mx-auto max-w-[1280px] space-y-8 px-4 py-20 lg:px-12 lg:py-28">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] uppercase tracking-wide text-on-surface-variant">
              Rifugio Sport · Val di Fassa
            </p>
            <h1
              className="max-w-[16ch] font-[family-name:var(--font-space-grotesk)] font-semibold"
              style={{
                fontSize: "clamp(40px, 7vw, 72px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              Il maestro e' al banco. Anche online.
            </h1>
            <p className="max-w-[52ch] text-[17px] text-on-surface-variant">
              Noleggio e vendita attrezzatura sciistica. Chiedi al concierge
              cosa ti serve, se c'e' per le tue date e quanto costa — e prenota
              nella stessa conversazione.
            </p>
            <Button
              size="lg"
              className="h-12 px-6"
              nativeButton={false}
              render={<Link href="/concierge" />}
            >
              Parla col concierge
            </Button>
          </div>
        </section>

        <section>
          <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3 lg:px-12">
            {PROMISES.map((promise) => (
              <Card key={promise.title}>
                <CardContent className="space-y-3 pt-6">
                  <HugeiconsIcon
                    icon={promise.icon}
                    size={24}
                    strokeWidth={1.6}
                    className="text-primary"
                  />
                  <h2 className="text-[18px] font-semibold">{promise.title}</h2>
                  <p className="text-[15px] text-on-surface-variant">
                    {promise.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <WordmarkFooter />
    </>
  );
}
