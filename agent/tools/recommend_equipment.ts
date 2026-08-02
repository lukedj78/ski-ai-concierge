import { and, eq, sql } from "drizzle-orm";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { catalog, hasDatabase } from "../lib/catalog";
import { getDb } from "../../db/index";
import { equipment } from "../../db/schema";

type Level = "beginner" | "intermediate" | "advanced" | "expert";
type Style = "piste" | "all_mountain" | "freeride";

/**
 * Lunghezza sci consigliata, in centimetri.
 *
 * La regola e' quella del banco, scritta per intero perche' il modello non deve
 * inventarne una propria:
 *   partenza  = altezza meno uno scarto che si accorcia col crescere del livello
 *   stile     = la pista accorcia, il freeride allunga
 *   peso      = chi pesa piu' della media per la sua altezza piega di piu' lo
 *               sci e ne regge qualche centimetro in piu'
 * Il risultato resta fra 140 e 190 cm, che e' l'intervallo che ha senso tenere
 * a magazzino.
 */
export function recommendedSkiLength(
  heightCm: number,
  weightKg: number,
  level: Level,
  style: Style,
): number {
  const levelOffset = {
    beginner: -15,
    intermediate: -10,
    advanced: -5,
    expert: 0,
  }[level];

  const styleOffset = { piste: -5, all_mountain: 0, freeride: 5 }[style];

  const expectedWeight = heightCm - 110;
  const weightDelta = weightKg - expectedWeight;
  const weightOffset = weightDelta > 10 ? 3 : weightDelta < -10 ? -3 : 0;

  const raw = heightCm + levelOffset + styleOffset + weightOffset;
  return Math.min(190, Math.max(140, Math.round(raw)));
}

/**
 * Da numero europeo a mondopoint, cioe' la lunghezza del piede in centimetri.
 * Approssimazione arrotondata al mezzo punto: EU 42 → 27.0, EU 40 → 25.5.
 */
export function euToMondopoint(euSize: number): number {
  return Math.round(((euSize * 2) / 3 - 1) * 2) / 2;
}

/** Flex dello scarpone: cresce col livello e col peso. */
export function recommendedFlex(level: Level, weightKg: number): number {
  const base = { beginner: 60, intermediate: 80, advanced: 100, expert: 120 }[
    level
  ];
  const weightOffset = weightKg > 85 ? 10 : weightKg < 60 ? -10 : 0;
  return base + weightOffset;
}

export default defineTool({
  description:
    "Dal profilo del cliente (livello, altezza, peso, stile di sciata) al setup consigliato: sci con la lunghezza giusta, scarponi, bastoncini. Ritorna solo articoli che esistono davvero a magazzino. Richiede tutti e quattro i dati: senza, non consigliare nulla.",
  inputSchema: z.object({
    level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
    heightCm: z.number().int().min(100).max(220),
    weightKg: z.number().int().min(25).max(200),
    style: z.enum(["piste", "all_mountain", "freeride"]),
    shoeSizeEu: z
      .number()
      .min(30)
      .max(50)
      .optional()
      .describe(
        "Numero di scarpa europeo. Se manca, gli scarponi non vengono proposti.",
      ),
  }),
  async execute(input) {
    const targetLengthPre = recommendedSkiLength(
      input.heightCm,
      input.weightKg,
      input.level,
      input.style,
    );

    if (!hasDatabase()) {
      const flexMem = recommendedFlex(input.level, input.weightKg);
      const mondoMem = input.shoeSizeEu
        ? euToMondopoint(input.shoeSizeEu)
        : undefined;
      const poleTarget = Math.round(input.heightCm * 0.68);

      const nearest = (
        items: typeof catalog,
        value: (item: (typeof catalog)[number]) => number | undefined,
        target: number,
      ) =>
        items
          .filter((item) => value(item) !== undefined)
          .sort(
            (a, b) =>
              Math.abs((value(a) as number) - target) -
              Math.abs((value(b) as number) - target),
          )[0];

      const ski = nearest(
        catalog.filter(
          (item) =>
            item.category === "skis" &&
            item.level === input.level &&
            item.style === input.style,
        ),
        (item) => item.lengthCm,
        targetLengthPre,
      );
      const pole = nearest(
        catalog.filter((item) => item.category === "poles"),
        (item) => item.lengthCm,
        poleTarget,
      );
      const boot = mondoMem
        ? nearest(
            catalog.filter((item) => item.category === "boots"),
            (item) =>
              item.mondopoint ? Number.parseFloat(item.mondopoint) : undefined,
            mondoMem,
          )
        : undefined;

      const setupMem = [];
      if (ski) {
        setupMem.push({
          category: "skis" as const,
          equipmentId: ski.id,
          label: `${ski.brand} ${ski.model} ${ski.lengthCm} cm`,
          reason: `${targetLengthPre} cm e' la misura giusta per ${input.heightCm} cm e ${input.weightKg} kg con uno stile ${input.style}; a magazzino la piu' vicina e' ${ski.lengthCm} cm.`,
        });
      }
      if (boot) {
        setupMem.push({
          category: "boots" as const,
          equipmentId: boot.id,
          label: `${boot.brand} ${boot.model} mondopoint ${boot.mondopoint}`,
          reason: `Con il ${input.shoeSizeEu} europeo il mondopoint e' circa ${mondoMem}; il flex indicato per il tuo livello e peso e' ${flexMem}.`,
        });
      }
      if (pole) {
        setupMem.push({
          category: "poles" as const,
          equipmentId: pole.id,
          label: `${pole.brand} ${pole.model} ${pole.lengthCm} cm`,
          reason: `I bastoncini si prendono a circa il 68% dell'altezza: ${poleTarget} cm.`,
        });
      }

      const missingMem: string[] = [];
      if (!ski) missingMem.push("sci del livello e dello stile richiesti");
      if (!input.shoeSizeEu)
        missingMem.push("numero di scarpa per gli scarponi");

      return {
        profile: {
          level: input.level,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          style: input.style,
        },
        targetSkiLengthCm: targetLengthPre,
        recommendedFlex: flexMem,
        mondopoint: mondoMem ?? null,
        setup: setupMem,
        missing: missingMem,
        source: "catalogo in memoria (nessun database configurato)",
      };
    }

    const db = getDb();

    const targetLength = recommendedSkiLength(
      input.heightCm,
      input.weightKg,
      input.level,
      input.style,
    );
    const flex = recommendedFlex(input.level, input.weightKg);

    // Fra gli sci del livello e dello stile giusti si prende quello con la
    // lunghezza piu' vicina al target: il catalogo non ha tutte le misure.
    const skis = await db
      .select()
      .from(equipment)
      .where(
        and(
          eq(equipment.category, "skis"),
          eq(equipment.status, "available"),
          eq(equipment.level, input.level),
          eq(equipment.style, input.style),
        ),
      )
      .orderBy(sql`abs(${equipment.lengthCm} - ${targetLength})`)
      .limit(1);

    const poles = await db
      .select()
      .from(equipment)
      .where(
        and(eq(equipment.category, "poles"), eq(equipment.status, "available")),
      )
      .orderBy(
        sql`abs(${equipment.lengthCm} - ${Math.round(input.heightCm * 0.68)})`,
      )
      .limit(1);

    const mondopoint = input.shoeSizeEu
      ? euToMondopoint(input.shoeSizeEu)
      : undefined;

    const boots = mondopoint
      ? await db
          .select()
          .from(equipment)
          .where(
            and(
              eq(equipment.category, "boots"),
              eq(equipment.status, "available"),
            ),
          )
          .orderBy(
            sql`abs(cast(${equipment.mondopoint} as numeric) - ${mondopoint})`,
          )
          .limit(1)
      : [];

    const setup = [];

    if (skis[0]) {
      setup.push({
        category: "skis" as const,
        equipmentId: skis[0].id,
        label: `${skis[0].brand} ${skis[0].model} ${skis[0].lengthCm} cm`,
        reason: `${targetLength} cm e' la misura giusta per ${input.heightCm} cm e ${input.weightKg} kg con uno stile ${input.style}; a magazzino la piu' vicina e' ${skis[0].lengthCm} cm.`,
      });
    }

    if (boots[0]) {
      setup.push({
        category: "boots" as const,
        equipmentId: boots[0].id,
        label: `${boots[0].brand} ${boots[0].model} mondopoint ${boots[0].mondopoint}`,
        reason: `Con il ${input.shoeSizeEu} europeo il mondopoint e' circa ${mondopoint}; il flex indicato per il tuo livello e peso e' ${flex}.`,
      });
    }

    if (poles[0]) {
      setup.push({
        category: "poles" as const,
        equipmentId: poles[0].id,
        label: `${poles[0].brand} ${poles[0].model} ${poles[0].lengthCm} cm`,
        reason: `I bastoncini si prendono a circa il 68% dell'altezza: ${Math.round(input.heightCm * 0.68)} cm.`,
      });
    }

    const missing: string[] = [];
    if (!skis[0]) missing.push("sci del livello e dello stile richiesti");
    if (!input.shoeSizeEu) missing.push("numero di scarpa per gli scarponi");
    else if (!boots[0]) missing.push("scarponi nella taglia richiesta");

    return {
      profile: {
        level: input.level,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        style: input.style,
      },
      targetSkiLengthCm: targetLength,
      recommendedFlex: flex,
      mondopoint: mondopoint ?? null,
      setup,
      missing,
    };
  },
});
