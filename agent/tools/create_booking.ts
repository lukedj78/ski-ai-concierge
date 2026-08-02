import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDb } from "../../db/index";
import { bookings, equipment, rentalRates, rentals } from "../../db/schema";
import { rentalDays } from "./calculate_rental_price";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come AAAA-MM-GG.");

const ALPHABET = "ACDEFHJKLMNPRTUVWXY34679";

/**
 * Codice prenotazione leggibile ad alta voce: niente zero contro O, niente
 * uno contro I. Il cliente lo detta al banco, e deve arrivare giusto.
 */
function bookingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `SKI-${code}`;
}

export default defineTool({
  description:
    "Crea la prenotazione di noleggio per i pezzi indicati. E' l'unico strumento che scrive: usalo solo dopo aver ricapitolato date, articoli e totale e aver ricevuto una conferma esplicita. Se nel frattempo un pezzo non e' piu' libero, non scrive nulla e lo dice.",
  inputSchema: z.object({
    guestName: z.string().min(2),
    guestEmail: z.string().email().optional(),
    startDate: isoDate,
    endDate: isoDate,
    equipmentIds: z
      .array(z.string().uuid())
      .min(1)
      .describe("Gli id restituiti da get_equipment_availability."),
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

    const db = getDb();

    return db.transaction(async (tx) => {
      const pieces = await tx
        .select()
        .from(equipment)
        .where(inArray(equipment.id, input.equipmentIds));

      if (pieces.length !== input.equipmentIds.length) {
        return {
          error: "attrezzatura_inesistente",
          message:
            "Uno degli articoli richiesti non esiste piu' a catalogo. Ricontrolla la disponibilita'.",
        };
      }

      // Ricontrollo dentro la transazione: fra il momento in cui il cliente ha
      // visto la disponibilita' e adesso puo' essere passato chiunque.
      const conflicts = await tx
        .select({ equipmentId: rentals.equipmentId })
        .from(rentals)
        .innerJoin(bookings, eq(rentals.bookingId, bookings.id))
        .where(
          and(
            inArray(rentals.equipmentId, input.equipmentIds),
            ne(bookings.status, "cancelled"),
            lte(rentals.startDate, input.endDate),
            gte(rentals.endDate, input.startDate),
          ),
        );

      if (conflicts.length > 0) {
        const taken = pieces.filter((piece) =>
          conflicts.some((conflict) => conflict.equipmentId === piece.id),
        );
        return {
          error: "non_piu_disponibile",
          message:
            "Nel frattempo qualcuno ha prenotato uno degli articoli. Non ho scritto niente.",
          unavailable: taken.map((piece) => ({
            id: piece.id,
            label: `${piece.brand} ${piece.model}`,
          })),
        };
      }

      let totalCents = 0;
      let depositCents = 0;
      const lines: { equipmentId: string; priceCents: number }[] = [];

      for (const piece of pieces) {
        const [rate] = await tx
          .select()
          .from(rentalRates)
          .where(
            and(
              eq(rentalRates.category, piece.category),
              lte(rentalRates.minDays, days),
              piece.level ? eq(rentalRates.level, piece.level) : undefined,
            ),
          )
          .orderBy(desc(rentalRates.minDays))
          .limit(1);

        if (!rate) {
          return {
            error: "listino_mancante",
            message: `Non c'e' una tariffa a listino per ${piece.category}.`,
          };
        }

        const linePrice =
          rate.pricePerDayCents * days +
          (input.withInsurance ? rate.insurancePerDayCents * days : 0);

        totalCents += linePrice;
        depositCents += rate.depositCents;
        lines.push({ equipmentId: piece.id, priceCents: linePrice });
      }

      const code = bookingCode();

      const [booking] = await tx
        .insert(bookings)
        .values({
          code,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "confirmed",
          withInsurance: input.withInsurance,
          totalCents,
          depositCents,
        })
        .returning();

      await tx.insert(rentals).values(
        lines.map((line) => ({
          bookingId: booking.id,
          equipmentId: line.equipmentId,
          startDate: input.startDate,
          endDate: input.endDate,
          priceCents: line.priceCents,
        })),
      );

      return {
        code: booking.code,
        status: booking.status,
        period: { startDate: input.startDate, endDate: input.endDate, days },
        items: pieces.map((piece) => ({
          id: piece.id,
          label: `${piece.brand} ${piece.model}`,
          category: piece.category,
        })),
        totalCents,
        depositCents,
        currency: "EUR",
      };
    });
  },
});
