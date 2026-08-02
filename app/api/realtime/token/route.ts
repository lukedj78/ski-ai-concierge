import { gateway } from "@ai-sdk/gateway";
import { voiceModels } from "@/agent/subagents/voice/models";

/**
 * Gettone di connessione per la sessione vocale realtime.
 *
 * La chiave del Gateway resta sul server: `getToken` la scambia con un segreto
 * a vita breve, monouso, valido solo per quel modello.
 *
 * I tool si dichiarano qui, non nel browser. La sessione vocale ne ha uno solo:
 * per prezzi, disponibilita' e policy chiede al negozio, cioe' a eve.
 */
const TOOLS = [
  {
    type: "function",
    name: "chiedi_al_negozio",
    description:
      "Chiede al sistema del negozio qualunque cosa riguardi attrezzatura, disponibilita', prezzi, prenotazioni o policy. Usalo sempre per queste cose: tu non conosci ne' il magazzino ne' il listino.",
    parameters: {
      type: "object",
      properties: {
        domanda: {
          type: "string",
          description: "La domanda del cliente, per intero, in italiano.",
        },
      },
      required: ["domanda"],
    },
  },
];

/** Quale modello usare. Il browser lo chiede, non lo sa. */
export function GET() {
  return Response.json({
    model: voiceModels.realtime,
    voice: voiceModels.realtimeVoice,
    transcription: voiceModels.transcription,
  });
}

export async function POST() {
  // Non si controlla la presenza di AI_GATEWAY_API_KEY: sui deployment Vercel
  // l'autenticazione al Gateway passa dall'OIDC del progetto e la chiave non
  // serve. Se manca davvero, e' `getToken` a dirlo con l'errore giusto.
  try {
    const { token, url } = await gateway.experimental_realtime.getToken({
      model: voiceModels.realtime,
    });
    return Response.json({ token, url, tools: TOOLS });
  } catch (error) {
    console.error("[voce] gettone realtime non coniato", error);
    return Response.json(
      {
        error: "voce_non_disponibile",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
