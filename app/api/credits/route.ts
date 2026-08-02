import { env } from "@/lib/env";

/**
 * Il saldo dei crediti del Gateway.
 *
 * Serve a sapere quanto manca alla fine, invece di scoprirlo quando la voce
 * smette di funzionare in mezzo a una demo. La chiave resta sul server: il
 * browser riceve solo due numeri.
 *
 * Nota: gli eventi di consumo sono ingeriti in modo asincrono, quindi il saldo
 * puo' essere indietro di qualche secondo rispetto all'ultima risposta.
 */
export async function GET() {
  const key = env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  if (!key) {
    return Response.json(
      { error: "chiave_mancante", message: "Nessuna credenziale per il Gateway." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
      headers: { authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return Response.json(
        { error: "saldo_non_leggibile", message: body.slice(0, 200) },
        { status: response.status },
      );
    }

    const credits = (await response.json()) as {
      balance?: string;
      total_used?: string;
    };

    return Response.json({
      balance: Number(credits.balance ?? 0),
      totalUsed: Number(credits.total_used ?? 0),
    });
  } catch (error) {
    console.error("[crediti] lettura fallita", error);
    return Response.json(
      {
        error: "saldo_non_leggibile",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
