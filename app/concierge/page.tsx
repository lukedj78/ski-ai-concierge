import { access } from "node:fs/promises";
import { join } from "node:path";
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
 * Dove si cerca il modello 3D, in ordine. Il primo che esiste vince.
 * `NEXT_PUBLIC_AVATAR_URL` ha la precedenza e accetta anche un URL assoluto.
 */
const AVATAR_CANDIDATES = ["/avatar/instructor.glb", "/avatar/instructor.vrm"];

async function resolveAvatarUrl(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_AVATAR_URL;
  if (configured && !configured.startsWith("/")) return configured;

  for (const candidate of configured ? [configured] : AVATAR_CANDIDATES) {
    try {
      await access(join(process.cwd(), "public", candidate));
      return candidate;
    } catch {
      // Si prova il prossimo.
    }
  }
  return null;
}

export default async function ConciergePage() {
  const avatarUrl = await resolveAvatarUrl();

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
          avatarUrl={avatarUrl}
        />
      </main>
    </>
  );
}
