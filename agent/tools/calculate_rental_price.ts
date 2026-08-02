import { and, desc, eq, lte } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { hasDatabase, rateFor } from "../lib/catalog";
import { getDb } from "../../db/index";
import { rentalRates } from "../../db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come AAAA-MM-GG.");

/** Giorni di noleggio, estremi inclusi: dal 5 all'8 sono quattro giorni. */
export function rentalDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export default defineTool({
  description:
    "Calcola il prezzo di un noleggio: giorni, fascia di durata da listino, cauzione e assicurazione opzionale. Ritorna il totale scomposto per voce. Nessun prezzo va detto al cliente senza aver chiamato questo tool.",
  inputSchema: z.object({
    startDate: isoDate,
    endDate: isoDate,
    items: z
      .array(
        z.object({
          category: z.enum(["skis", "snowboard", "boots", "poles", "helmet"]),
          level: z
            .enum(["beginner", "intermediate", "advanced", "expert"])
            .optional(),
          quantity: z.number().int().min(1).default(1),
        }),
      )
      .min(1),
    withInsurance: z.boolean().default(false),
  }),
  async execute(input) {
    const days = rentalDays(input.startDate, input.endDate);
    if (days < 1) {
      return {
        error: "periodo_non_valido",
        message: "Il periodo richiesto non copre nemmeno un giorno.",
      };
    }

    if (!hasDatabase()) {
      const lines = [];
      let subtotalCents = 0;
      let insuranceCents = 0;
      let depositCents = 0;

      for (const item of input.items) {
        const rate = rateFor(item.category, item.level, days);
        if (!rate) {
          return {
            error: "listino_mancante",
            message: `Non c'e' una tariffa a listino per ${item.category}.`,
          };
        }
        const lineTotal = rate.pricePerDayCents * days * item.quantity;
        const lineInsurance = input.withInsurance
          ? rate.insurancePerDayCents * days * item.quantity
          : 0;
        subtotalCents += lineTotal;
        insuranceCents += lineInsurance;
        depositCents += rate.depositCents * item.quantity;
        lines.push({
          category: item.category,
          level: item.level ?? null,
          quantity: item.quantity,
          days,
          tierFromDays: rate.minDays,
          pricePerDayCents: rate.pricePerDayCents,
          lineTotalCents: lineTotal,
          insuranceCents: lineInsurance,
        });
      }

      return {
        period: { startDate: input.startDate, endDate: input.endDate, days },
        lines,
        subtotalCents,
        insuranceCents,
        totalCents: subtotalCents + insuranceCents,
        depositCents,
        currency: "EUR",
        source: "listino in memoria (nessun database configurato)",
      };
    }

    const db = getDb();
    const lines = [];
    let subtotalCents = 0;
    let insuranceCents = 0;
    let depositCents = 0;

    for (const item of input.items) {
      // La fascia applicabile e' quella con la soglia piu' alta fra quelle
      // raggiunte dai giorni richiesti.
      const [rate] = await db
        .select()
        .from(rentalRates)
        .where(
          and(
            eq(rentalRates.category, item.category),
            lte(rentalRates.minDays, days),
            item.level ? eq(rentalRates.level, item.level) : undefined,
          ),
        )
        .orderBy(desc(rentalRates.minDays))
        .limit(1);

      if (!rate) {
        return {
          error: "listino_mancante",
          message: `Non c'e' una tariffa a listino per ${item.category}${
            item.level ? ` di livello ${item.level}` : ""
          }.`,
        };
      }

      const lineTotal = rate.pricePerDayCents * days * item.quantity;
      const lineInsurance = input.withInsurance
        ? rate.insurancePerDayCents * days * item.quantity
        : 0;
      const lineDeposit = rate.depositCents * item.quantity;

      subtotalCents += lineTotal;
      insuranceCents += lineInsurance;
      depositCents += lineDeposit;

      lines.push({
        category: item.category,
        level: item.level ?? null,
        quantity: item.quantity,
        days,
        tierFromDays: rate.minDays,
        pricePerDayCents: rate.pricePerDayCents,
        lineTotalCents: lineTotal,
        insuranceCents: lineInsurance,
      });
    }

    return {
      period: { startDate: input.startDate, endDate: input.endDate, days },
      lines,
      subtotalCents,
      insuranceCents,
      totalCents: subtotalCents + insuranceCents,
      // La cauzione non e' un addebito: e' un'autorizzazione, va tenuta fuori
      // dal totale e detta come voce separata.
      depositCents,
      currency: "EUR",
    };
  },
});
