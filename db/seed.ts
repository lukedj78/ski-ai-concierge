/**
 * Popola il negozio: magazzino, listino, catalogo di vendita e documentazione.
 *
 * I dati sono verosimili ma inventati. Prima di mostrare la demo a chi il
 * mestiere lo conosce vanno sostituiti con i listini veri di un negozio — sta
 * scritto anche in PRD.md fra le domande aperte.
 *
 * Il seed e' idempotente: rilanciarlo non duplica niente. Le prenotazioni di
 * prova vengono ricreate da zero a ogni giro, il resto viene riconciliato.
 *
 *   pnpm db:seed
 */

import { gateway } from "@ai-sdk/gateway";
import { embedMany } from "ai";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  equipment,
  knowledgeDocuments,
  products,
  rentalRates,
} from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL non e' configurata. Copia .env.example in .env.local e incolla la connection string di Neon.",
  );
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Magazzino
// ---------------------------------------------------------------------------

type SkiSpec = {
  brand: string;
  model: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  style: "piste" | "all_mountain" | "freeride";
  lengths: number[];
  /** Quante copie per ogni lunghezza: in alta stagione serve profondita'. */
  copies: number;
};

const SKIS: SkiSpec[] = [
  {
    brand: "Rossignol",
    model: "Experience 78",
    level: "beginner",
    style: "piste",
    lengths: [144, 152, 160, 166],
    copies: 3,
  },
  {
    brand: "Atomic",
    model: "Cloud Q8",
    level: "beginner",
    style: "piste",
    lengths: [147, 154, 161],
    copies: 2,
  },
  {
    brand: "Salomon",
    model: "S/Force 9",
    level: "intermediate",
    style: "piste",
    lengths: [155, 162, 168, 175],
    copies: 3,
  },
  {
    brand: "Head",
    model: "Kore 87",
    level: "intermediate",
    style: "all_mountain",
    lengths: [156, 163, 170, 177],
    copies: 3,
  },
  {
    brand: "Volkl",
    model: "Deacon 84",
    level: "advanced",
    style: "piste",
    lengths: [161, 168, 175, 182],
    copies: 2,
  },
  {
    brand: "Blizzard",
    model: "Rustler 10",
    level: "advanced",
    style: "all_mountain",
    lengths: [164, 172, 180, 188],
    copies: 2,
  },
  {
    brand: "Faction",
    model: "Dictator 3.0",
    level: "expert",
    style: "freeride",
    lengths: [172, 180, 186],
    copies: 2,
  },
  {
    brand: "Black Crows",
    model: "Corvus",
    level: "expert",
    style: "freeride",
    lengths: [178, 183, 188],
    copies: 1,
  },
];

const BOOTS = [
  { brand: "Nordica", model: "Speedmachine 3 85", flex: 85 },
  { brand: "Lange", model: "RX 110", flex: 110 },
  { brand: "Atomic", model: "Hawx Prime 70", flex: 70 },
];

/** Mondopoint reali a magazzino: dal 22.5 al 30.5, mezzo punto per volta. */
const MONDOPOINTS = Array.from({ length: 17 }, (_, i) =>
  (22.5 + i * 0.5).toFixed(1),
);

function buildEquipment() {
  const rows: (typeof equipment.$inferInsert)[] = [];

  for (const ski of SKIS) {
    for (const length of ski.lengths) {
      for (let copy = 0; copy < ski.copies; copy += 1) {
        rows.push({
          category: "skis",
          brand: ski.brand,
          model: ski.model,
          lengthCm: length,
          level: ski.level,
          style: ski.style,
          sizeLabel: `${length} cm`,
          status: "available",
        });
      }
    }
  }

  for (const boot of BOOTS) {
    for (const mondopoint of MONDOPOINTS) {
      rows.push({
        category: "boots",
        brand: boot.brand,
        model: boot.model,
        mondopoint,
        sizeLabel: `MP ${mondopoint}`,
        level: boot.flex >= 100 ? "advanced" : boot.flex >= 85 ? "intermediate" : "beginner",
        status: "available",
        notes: `Flex ${boot.flex}`,
      });
    }
  }

  for (const length of [100, 105, 110, 115, 120, 125, 130]) {
    for (let copy = 0; copy < 4; copy += 1) {
      rows.push({
        category: "poles",
        brand: "Leki",
        model: "Rider",
        lengthCm: length,
        sizeLabel: `${length} cm`,
        status: "available",
      });
    }
  }

  for (const size of ["XS", "S", "M", "L", "XL"]) {
    for (let copy = 0; copy < 6; copy += 1) {
      rows.push({
        category: "helmet",
        brand: "Giro",
        model: "Ledge MIPS",
        sizeLabel: size,
        status: "available",
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Listino noleggio, a fasce di durata
// ---------------------------------------------------------------------------

const RATES: (typeof rentalRates.$inferInsert)[] = [
  // Sci: il prezzo per giorno scende man mano che la durata cresce.
  { category: "skis", level: "beginner", minDays: 1, pricePerDayCents: 2200, depositCents: 15000, insurancePerDayCents: 400 },
  { category: "skis", level: "beginner", minDays: 3, pricePerDayCents: 1900, depositCents: 15000, insurancePerDayCents: 400 },
  { category: "skis", level: "beginner", minDays: 6, pricePerDayCents: 1600, depositCents: 15000, insurancePerDayCents: 400 },
  { category: "skis", level: "intermediate", minDays: 1, pricePerDayCents: 2900, depositCents: 20000, insurancePerDayCents: 500 },
  { category: "skis", level: "intermediate", minDays: 3, pricePerDayCents: 2500, depositCents: 20000, insurancePerDayCents: 500 },
  { category: "skis", level: "intermediate", minDays: 6, pricePerDayCents: 2100, depositCents: 20000, insurancePerDayCents: 500 },
  { category: "skis", level: "advanced", minDays: 1, pricePerDayCents: 3600, depositCents: 30000, insurancePerDayCents: 600 },
  { category: "skis", level: "advanced", minDays: 3, pricePerDayCents: 3100, depositCents: 30000, insurancePerDayCents: 600 },
  { category: "skis", level: "advanced", minDays: 6, pricePerDayCents: 2600, depositCents: 30000, insurancePerDayCents: 600 },
  { category: "skis", level: "expert", minDays: 1, pricePerDayCents: 4400, depositCents: 40000, insurancePerDayCents: 800 },
  { category: "skis", level: "expert", minDays: 3, pricePerDayCents: 3800, depositCents: 40000, insurancePerDayCents: 800 },
  { category: "skis", level: "expert", minDays: 6, pricePerDayCents: 3200, depositCents: 40000, insurancePerDayCents: 800 },
  // Scarponi, bastoncini e caschi non cambiano col livello.
  { category: "boots", level: null, minDays: 1, pricePerDayCents: 1500, depositCents: 10000, insurancePerDayCents: 300 },
  { category: "boots", level: null, minDays: 3, pricePerDayCents: 1300, depositCents: 10000, insurancePerDayCents: 300 },
  { category: "boots", level: null, minDays: 6, pricePerDayCents: 1100, depositCents: 10000, insurancePerDayCents: 300 },
  { category: "poles", level: null, minDays: 1, pricePerDayCents: 500, depositCents: 2000, insurancePerDayCents: 100 },
  { category: "poles", level: null, minDays: 6, pricePerDayCents: 400, depositCents: 2000, insurancePerDayCents: 100 },
  { category: "helmet", level: null, minDays: 1, pricePerDayCents: 700, depositCents: 3000, insurancePerDayCents: 100 },
  { category: "helmet", level: null, minDays: 6, pricePerDayCents: 600, depositCents: 3000, insurancePerDayCents: 100 },
  { category: "snowboard", level: null, minDays: 1, pricePerDayCents: 2800, depositCents: 20000, insurancePerDayCents: 500 },
  { category: "snowboard", level: null, minDays: 6, pricePerDayCents: 2200, depositCents: 20000, insurancePerDayCents: 500 },
];

// ---------------------------------------------------------------------------
// Catalogo di vendita
// ---------------------------------------------------------------------------

const PRODUCTS: (typeof products.$inferInsert)[] = [
  {
    category: "boots",
    brand: "Nordica",
    model: "Speedmachine 3 100",
    priceCents: 42900,
    sizes: MONDOPOINTS.slice(2, 14),
    stock: 12,
    level: "intermediate",
    description:
      "Scarpone da pista con scafo termoformabile. Il pezzo che conviene comprare invece di noleggiare: si adatta al piede e resta tuo.",
  },
  {
    category: "boots",
    brand: "Lange",
    model: "RS 130",
    priceCents: 59900,
    sizes: MONDOPOINTS.slice(4, 14),
    stock: 5,
    level: "expert",
    description: "Flex 130, calzata stretta. Per chi scia veloce e sa cosa vuole.",
  },
  {
    category: "helmet",
    brand: "Giro",
    model: "Grid Spherical",
    priceCents: 24900,
    sizes: ["S", "M", "L"],
    stock: 9,
    description: "Casco con tecnologia MIPS sferica e ventilazione regolabile.",
  },
  {
    category: "skis",
    brand: "Head",
    model: "Kore 91",
    priceCents: 64900,
    sizes: ["163", "170", "177", "184"],
    stock: 4,
    level: "advanced",
    description: "All-mountain leggero, a suo agio dentro e fuori pista.",
  },
];

// ---------------------------------------------------------------------------
// Documentazione del negozio
// ---------------------------------------------------------------------------

const KNOWLEDGE = [
  {
    sourceKey: "orari",
    title: "Orari e sedi",
    section: "Informazioni generali",
    content:
      "Il negozio di Canazei e' aperto tutti i giorni dalle 8:00 alle 19:00 durante la stagione (dicembre-aprile). Il punto di ritiro a Campitello apre alle 8:30 e chiude alle 18:00. Fuori stagione si apre solo su appuntamento.",
  },
  {
    sourceKey: "ritiro",
    title: "Ritiro dell'attrezzatura",
    section: "Noleggio",
    content:
      "Il ritiro avviene in negozio con un documento d'identita' e il codice della prenotazione. Chi ritira dopo le 16:00 non paga quel giorno: il conteggio parte dal mattino successivo. La regolazione degli attacchi si fa al banco e richiede circa dieci minuti a persona.",
  },
  {
    sourceKey: "restituzione",
    title: "Restituzione e ritardi",
    section: "Noleggio",
    content:
      "L'attrezzatura va restituita entro l'orario di chiusura dell'ultimo giorno di noleggio. Il ritardo si conteggia a giorno intero, non a ore: riportare gli sci alle 19:30 costa un giorno in piu'. Se il ritardo dipende da un impianto chiuso o da un problema di viabilita' non viene addebitato.",
  },
  {
    sourceKey: "cauzione",
    title: "Cauzione",
    section: "Noleggio",
    content:
      "La cauzione e' un'autorizzazione sulla carta di credito, non un addebito, e viene rilasciata alla riconsegna. L'importo dipende dalla categoria: 150 euro per gli sci base, fino a 400 euro per i modelli da freeride, 100 euro per gli scarponi. Non si accettano cauzioni in contanti.",
  },
  {
    sourceKey: "assicurazione",
    title: "Assicurazione",
    section: "Noleggio",
    content:
      "L'assicurazione e' facoltativa e si aggiunge al prezzo giornaliero. Copre la rottura accidentale e il furto con denuncia alle autorita'. Non copre lo smarrimento ne' i danni da uso improprio, per esempio l'uso su terreno privo di neve. Si sottoscrive al momento della prenotazione e non e' aggiungibile dopo il ritiro.",
  },
  {
    sourceKey: "cancellazione",
    title: "Cancellazione e modifiche",
    section: "Policy",
    content:
      "La prenotazione si cancella gratuitamente fino a 48 ore prima del ritiro. Fra le 48 e le 24 ore si trattiene il 30 per cento. Nelle ultime 24 ore l'importo e' dovuto per intero. Le modifiche di data sono sempre gratuite se c'e' disponibilita'. In caso di chiusura degli impianti per mancanza di neve il rimborso e' totale.",
  },
  {
    sourceKey: "pagamenti",
    title: "Pagamenti",
    section: "Policy",
    content:
      "Si paga al ritiro, in negozio: carte di credito e debito, bancomat, contanti fino a 999 euro. La prenotazione online non richiede pagamento anticipato. Per i gruppi sopra le dieci persone si emette fattura con pagamento a trenta giorni.",
  },
  {
    sourceKey: "bambini",
    title: "Attrezzatura per bambini",
    section: "Noleggio",
    content:
      "Il noleggio per i bambini fino a dodici anni comprende sci, scarponi, bastoncini e casco a un prezzo unico di 15 euro al giorno. Il casco per i minori e' obbligatorio per legge sulle piste italiane ed e' compreso, non e' un extra. Gli sci per bambini non si vendono: crescono troppo in fretta.",
  },
  {
    sourceKey: "manutenzione",
    title: "Manutenzione e sciolinatura",
    section: "Servizi",
    content:
      "La sciolinatura e l'affilatura delle lamine sono comprese nel noleggio e si fanno ogni sera sull'attrezzatura rientrata. Per l'attrezzatura di proprieta' il servizio costa 25 euro e si ritira il giorno dopo. La riparazione della soletta si valuta al banco.",
  },
  {
    sourceKey: "taglie",
    title: "Come si scelgono le misure",
    section: "Consulenza",
    content:
      "La lunghezza degli sci dipende da altezza, peso, livello e stile di sciata, non dalla sola altezza: chi pesa piu' della media per la propria statura flette di piu' lo sci e ne regge qualche centimetro in piu'. Gli scarponi si misurano in mondopoint, cioe' la lunghezza del piede in centimetri, che non coincide con il numero di scarpa. I bastoncini si prendono a circa il 68 per cento dell'altezza.",
  },
];

// ---------------------------------------------------------------------------
// Esecuzione
// ---------------------------------------------------------------------------

async function main() {
  console.log("Attivo l'estensione pgvector…");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log("Magazzino…");
  const rows = buildEquipment();
  // Il magazzino si ricrea da zero: e' un elenco di pezzi fisici, non ha
  // chiavi naturali su cui riconciliare.
  const [{ count: existing }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(equipment);
  if (existing === 0) {
    await db.insert(equipment).values(rows);
    console.log(`  ${rows.length} pezzi inseriti`);
  } else {
    console.log(`  ${existing} pezzi gia' presenti, non tocco niente`);
  }

  console.log("Listino…");
  await db.delete(rentalRates);
  await db.insert(rentalRates).values(RATES);
  console.log(`  ${RATES.length} tariffe`);

  console.log("Catalogo di vendita…");
  await db.delete(products);
  await db.insert(products).values(PRODUCTS);
  console.log(`  ${PRODUCTS.length} articoli`);

  console.log("Documentazione…");
  const { embeddings } = await embedMany({
    model: gateway.textEmbeddingModel(
      process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
    ),
    values: KNOWLEDGE.map(
      (document) => `${document.title}\n${document.content}`,
    ),
  });

  for (const [index, document] of KNOWLEDGE.entries()) {
    await db
      .insert(knowledgeDocuments)
      .values({ ...document, embedding: embeddings[index] })
      .onConflictDoUpdate({
        target: knowledgeDocuments.sourceKey,
        set: { ...document, embedding: embeddings[index] },
      });
  }
  console.log(`  ${KNOWLEDGE.length} documenti indicizzati`);

  console.log("\nFatto.");
}

try {
  await main();
} finally {
  await client.end();
}
