import type { Metadata } from "next";
import { voiceModels } from "@/agent/subagents/voice/models";
import { SiteTopNav } from "@/components/shared/site/site-top-nav";
import { ConciergeShell } from "./_components/ConciergeShell";

export const metadata: Metadata = {
  title: "Concierge — Rifugio Sport",
  description:
    "Parla col concierge: consiglio sull'attrezzatura, disponibilita', prezzi e prenotazione.",
};

/**
 * Il modello 3D. Si sostituisce mettendo un altro file in `public/avatar/`
 * oppure puntando `NEXT_PUBLIC_AVATAR_URL` altrove, anche a un URL assoluto.
 *
 * Non si verifica che il file esista: in una funzione serverless la cartella
 * `public/` non c'e' — la servono la CDN e il browser — quindi un controllo
 * con `access()` fallirebbe sempre in produzione e mostrerebbe il segnaposto
 * anche con il modello caricato. Se il file davvero non c'e', se ne accorge il
 * boundary attorno alla scena e ricade sulla figura disegnata.
 */
const AVATAR_URL =
  process.env.NEXT_PUBLIC_AVATAR_URL || "/avatar/instructor.glb";

export default function ConciergePage() {
  return (
    <>
      <SiteTopNav />
      <main className="flex min-h-0 flex-1 flex-col bg-background">
        {/* I modelli arrivano dal sub-agente voce e scendono come props: il
            componente client non li conosce e non li sceglie. */}
        <ConciergeShell
          model={voiceModels.realtime}
          voice={voiceModels.realtimeVoice}
          transcription={voiceModels.transcription}
          avatarUrl={AVATAR_URL}
        />
      </main>
    </>
  );
}
