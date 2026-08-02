import { access } from "node:fs/promises";
import { join } from "node:path";
import { SiteTopNav } from "@/components/shared/site/site-top-nav";
import { ConciergeShell } from "./_components/ConciergeShell";

/**
 * Dove si cerca il modello, in ordine. Il primo che esiste vince.
 *
 * `NEXT_PUBLIC_AVATAR_URL` ha la precedenza su tutto e accetta anche un URL
 * assoluto, per chi ospita il modello altrove.
 */
const AVATAR_CANDIDATES = ["/avatar/instructor.glb", "/avatar/instructor.vrm"];

/**
 * La verifica del modello si fa qui, sul server, e non nel browser con un
 * effetto: il client riceve gia' la risposta e non deve montarsi due volte.
 */
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

  // Nessun modello: si vede il maestro disegnato in geometria. Il repository
  // resta eseguibile senza trascinarsi la licenza di un modello di terzi.
  return null;
}

export default async function Home() {
  const vrmUrl = await resolveAvatarUrl();

  return (
    <>
      {/* Nessun badge sullo stato dell'avatar: il server sa se la variabile
          e' valorizzata, non se il modello si e' davvero caricato. */}
      <SiteTopNav />
      <main className="flex min-h-0 flex-1 flex-col bg-background">
        <ConciergeShell vrmUrl={vrmUrl} />
      </main>
    </>
  );
}
