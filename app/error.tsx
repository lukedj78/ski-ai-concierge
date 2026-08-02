"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} />
            Qualcosa si e' rotto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Il messaggio dell'errore non si mostra: puo' contenere dettagli
              interni. Il digest basta a ritrovarlo nei log. */}
          <p className="text-on-surface-variant text-[15px]">
            Il concierge non e' riuscito a caricare la pagina. Riprova: se
            succede di nuovo, il problema e' nostro, non tuo.
          </p>
          {error.digest ? (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-on-surface-variant">
              codice: {error.digest}
            </p>
          ) : null}
          <Button onClick={reset}>Riprova</Button>
        </CardContent>
      </Card>
    </div>
  );
}
