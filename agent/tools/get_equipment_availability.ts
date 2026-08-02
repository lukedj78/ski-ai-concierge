import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { catalog, hasDatabase, isBusy } from "../lib/catalog";
import { getDb } from "../../db/index";
import { bookings, equipment, rentals } from "../../db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La data va scritta come AAAA-MM-GG.");

export default defineTool({
  description:
    "Controlla quali pezzi di attrezzatura sono liberi per un periodo. Filtra per categoria e, se noti, livello, stile, lunghezza in cm o mondopoint. Se il pezzo esatto e' occupato ritorna le alternative piu' vicine. E' l'unica fonte di verita' sulla disponibilita': non stimarla mai.",
  inputSchema: z.object({
    category: z.enum(["skis", "snowboard", "boots", "poles", "helmet"]),
    startDate: isoDate.describe("Primo giorno di noleggio, incluso."),
    endDate: isoDate.describe("Ultimo giorno di noleggio, incluso."),
    level: z
      .enum(["beginner", "intermediate", "advanced", "expert"])
      .optional(),
    style: z.enum(["piste", "all_mountain", "freeride"]).optional(),
    lengthCm: z
      .number()
      .int()
      .optional()
      .describe("Lunghezza sci desiderata in centimetri."),
    mondopoint: z
      .string()
      .optional()
      .describe("Taglia scarpone in mondopoint, per esempio 27.5."),
  }),
  async execute(input) {
    if (input.endDate < input.startDate) {
      return {
        error: "date_invertite",
        message: "La data di fine e' precedente a quella di inizio.",
      };
    }

    // Senza database il negozio vive in memoria: la demo gira lo stesso.
    if (!hasDatabase()) {
      const wantedLength = input.lengthCm;
      const wantedMondo = input.mondopoint
        ? Number.parseFloat(input.mondopoint)
        : undefined;

      const free = catalog
        .filter((item) => item.category === input.category)
        .filter((item) => (input.level ? item.level === input.level : true))
        .filter((item) => (input.style ? item.style === input.style : true))
        .filter((item) => !isBusy(item.id, input.startDate, input.endDate));

      const scored = free
        .map((item) => {
          let distance = 0;
          if (wantedLength && item.lengthCm) {
            distance = Math.abs(item.lengthCm - wantedLength);
          } else if (wantedMondo && item.mondopoint) {
            distance = Math.abs(
              Number.parseFloat(item.mondopoint) - wantedMondo,
            );
          }
          return { item, distance };
        })
        .sort((a, b) => a.distance - b.distance);

      const askedForSize = Boolean(wantedLength || wantedMondo);
      const exact = scored.filter((entry) => entry.distance === 0);
      const near = scored.filter((entry) => entry.distance > 0).slice(0, 4);
      const shape = (entry: (typeof scored)[number]) => ({
        id: entry.item.id,
        brand: entry.item.brand,
        model: entry.item.model,
        lengthCm: entry.item.lengthCm ?? null,
        mondopoint: entry.item.mondopoint ?? null,
        sizeLabel: entry.item.sizeLabel ?? null,
        level: entry.item.level ?? null,
        style: entry.item.style ?? null,
        distanceFromRequested: entry.distance,
      });

      return {
        period: { startDate: input.startDate, endDate: input.endDate },
        totalFree: free.length,
        exactMatches: (askedForSize ? exact : scored).slice(0, 8).map(shape),
        alternatives: askedForSize ? near.map(shape) : [],
        source: "catalogo in memoria (nessun database configurato)",
      };
    }

    const db = getDb();

    // Un pezzo e' occupato se esiste una riga di noleggio che si sovrappone al
    // periodo richiesto, su una prenotazione non annullata.
    const busy = db
      .select({ id: rentals.equipmentId })
      .from(rentals)
      .innerJoin(bookings, eq(rentals.bookingId, bookings.id))
      .where(
        and(
          ne(bookings.status, "cancelled"),
          lte(rentals.startDate, input.endDate),
          gte(rentals.endDate, input.startDate),
        ),
      );

    const filters = [
      eq(equipment.category, input.category),
      eq(equipment.status, "available"),
      sql`${equipment.id} NOT IN ${busy}`,
    ];
    if (input.level) filters.push(eq(equipment.level, input.level));
    if (input.style) filters.push(eq(equipment.style, input.style));

    const free = await db
      .select()
      .from(equipment)
      .where(and(...filters))
      .limit(60);

    // Se il cliente ha chiesto una misura precisa, si ordina per vicinanza:
    // la seconda scelta e' quella che al banco proporresti davvero.
    const wantedLength = input.lengthCm;
    const wantedMondo = input.mondopoint
      ? Number.parseFloat(input.mondopoint)
      : undefined;

    const scored = free
      .map((item) => {
        let distance = 0;
        if (wantedLength && item.lengthCm) {
          distance = Math.abs(item.lengthCm - wantedLength);
        } else if (wantedMondo && item.mondopoint) {
          distance = Math.abs(Number.parseFloat(item.mondopoint) - wantedMondo);
        }
        return { item, distance };
      })
      .sort((a, b) => a.distance - b.distance);

    const exact = scored.filter((entry) => entry.distance === 0);
    const near = scored.filter((entry) => entry.distance > 0).slice(0, 4);

    const shape = (entry: (typeof scored)[number]) => ({
      id: entry.item.id,
      brand: entry.item.brand,
      model: entry.item.model,
      lengthCm: entry.item.lengthCm,
      mondopoint: entry.item.mondopoint,
      sizeLabel: entry.item.sizeLabel,
      level: entry.item.level,
      style: entry.item.style,
      distanceFromRequested: entry.distance,
    });

    const askedForSize = Boolean(wantedLength || wantedMondo);

    return {
      period: { startDate: input.startDate, endDate: input.endDate },
      totalFree: free.length,
      exactMatches: (askedForSize ? exact : scored).slice(0, 8).map(shape),
      alternatives: askedForSize ? near.map(shape) : [],
      note:
        free.length === 0
          ? "Nessun pezzo libero in questa categoria per il periodo richiesto."
          : askedForSize && exact.length === 0
            ? "La misura esatta e' occupata: le alternative sono ordinate per vicinanza."
            : undefined,
    };
  },
});
