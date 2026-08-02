import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Dimensione del vettore di `openai/text-embedding-3-small`.
 *
 * Vive qui e non in `lib/env.ts` perche' drizzle-kit legge questo file da solo,
 * fuori dal path mapping di TypeScript: un import con alias lo romperebbe.
 */
export const EMBEDDING_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Enumerazioni del dominio
// ---------------------------------------------------------------------------

export const equipmentCategory = pgEnum("equipment_category", [
  "skis",
  "snowboard",
  "boots",
  "poles",
  "helmet",
]);

export const skierLevel = pgEnum("skier_level", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const skiStyle = pgEnum("ski_style", [
  "piste",
  "all_mountain",
  "freeride",
]);

export const equipmentStatus = pgEnum("equipment_status", [
  "available",
  "maintenance",
  "retired",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
]);

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

// ---------------------------------------------------------------------------
// Persone e conversazioni
// ---------------------------------------------------------------------------

/**
 * Il cliente. `externalAuthId` e' la predisposizione all'autenticazione
 * futura (Clerk o better-auth): la colonna esiste, non la usa nessuno.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalAuthId: text("external_auth_id"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_external_auth_id_idx").on(table.externalAuthId),
  ],
);

/**
 * La conversazione lato business.
 *
 * Attenzione: eve persiste gia' le proprie sessioni. Queste tabelle non
 * servono al runtime dell'agente — esistono per il reporting e per rileggere
 * cosa chiedono davvero i clienti. Il ponte fra i due mondi e' `eveSessionId`.
 */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  eveSessionId: text("eve_session_id").notNull(),
  channel: text("channel").notNull().default("web"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRole("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Magazzino e listino
// ---------------------------------------------------------------------------

/**
 * Il singolo pezzo a magazzino, non il modello: due paia di sci identici sono
 * due righe. E' l'unico modo per sapere se e' libero in una certa settimana.
 */
export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: equipmentCategory("category").notNull(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    // Sci e bastoncini si misurano in cm, gli scarponi in mondopoint,
    // i caschi in taglia. Una colonna sola non basterebbe.
    lengthCm: integer("length_cm"),
    mondopoint: text("mondopoint"),
    sizeLabel: text("size_label"),
    level: skierLevel("level"),
    style: skiStyle("style"),
    status: equipmentStatus("status").notNull().default("available"),
    notes: text("notes"),
  },
  (table) => [
    index("equipment_category_idx").on(table.category),
    index("equipment_lookup_idx").on(table.category, table.level, table.style),
  ],
);

/** Articoli in vendita, non a noleggio. */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: equipmentCategory("category").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  priceCents: integer("price_cents").notNull(),
  sizes: text("sizes").array().notNull().default([]),
  stock: integer("stock").notNull().default(0),
  level: skierLevel("level"),
  description: text("description"),
});

/**
 * Il listino noleggio a fasce di durata.
 *
 * `minDays` e' la soglia da cui la tariffa si applica: 1, 3, 6, 7 giorni. Il
 * prezzo non e' mai scritto nel codice dei tool, sta qui.
 */
export const rentalRates = pgTable("rental_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: equipmentCategory("category").notNull(),
  level: skierLevel("level"),
  minDays: integer("min_days").notNull(),
  pricePerDayCents: integer("price_per_day_cents").notNull(),
  depositCents: integer("deposit_cents").notNull().default(0),
  insurancePerDayCents: integer("insurance_per_day_cents").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Prenotazioni
// ---------------------------------------------------------------------------

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Codice leggibile ad alta voce: il cliente lo detta al banco.
    code: text("code").notNull(),
    userId: uuid("user_id").references(() => users.id),
    guestName: text("guest_name").notNull(),
    guestEmail: text("guest_email"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: bookingStatus("status").notNull().default("pending"),
    withInsurance: boolean("with_insurance").notNull().default(false),
    totalCents: integer("total_cents").notNull(),
    depositCents: integer("deposit_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("bookings_code_idx").on(table.code)],
);

/** La riga di noleggio: un pezzo, per un periodo, dentro una prenotazione. */
export const rentals = pgTable(
  "rentals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (table) => [
    index("rentals_equipment_period_idx").on(
      table.equipmentId,
      table.startDate,
      table.endDate,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Documentazione del negozio
// ---------------------------------------------------------------------------

/**
 * Policy e informazioni, con l'embedding per la ricerca semantica.
 * `sourceKey` e' la chiave di idempotenza del seed: rilanciarlo non duplica.
 */
export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceKey: text("source_key").notNull(),
    title: text("title").notNull(),
    section: text("section").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("knowledge_documents_source_key_idx").on(table.sourceKey),
    index("knowledge_documents_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type Equipment = typeof equipment.$inferSelect;
export type Product = typeof products.$inferSelect;
export type RentalRate = typeof rentalRates.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
