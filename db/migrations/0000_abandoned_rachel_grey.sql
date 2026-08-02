-- pgvector deve esistere prima della colonna `vector(1536)`: senza questa
-- riga la migrazione fallisce su un database appena creato.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."equipment_category" AS ENUM('skis', 'snowboard', 'boots', 'poles', 'helmet');--> statement-breakpoint
CREATE TYPE "public"."equipment_status" AS ENUM('available', 'maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."ski_style" AS ENUM('piste', 'all_mountain', 'freeride');--> statement-breakpoint
CREATE TYPE "public"."skier_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid,
	"guest_name" text NOT NULL,
	"guest_email" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"with_insurance" boolean DEFAULT false NOT NULL,
	"total_cents" integer NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"eve_session_id" text NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "equipment_category" NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"length_cm" integer,
	"mondopoint" text,
	"size_label" text,
	"level" "skier_level",
	"style" "ski_style",
	"status" "equipment_status" DEFAULT 'available' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"title" text NOT NULL,
	"section" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "equipment_category" NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"price_cents" integer NOT NULL,
	"sizes" text[] DEFAULT '{}' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"level" "skier_level",
	"description" text
);
--> statement-breakpoint
CREATE TABLE "rental_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "equipment_category" NOT NULL,
	"level" "skier_level",
	"min_days" integer NOT NULL,
	"price_per_day_cents" integer NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"insurance_per_day_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_auth_id" text,
	"name" text,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_code_idx" ON "bookings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "equipment_category_idx" ON "equipment" USING btree ("category");--> statement-breakpoint
CREATE INDEX "equipment_lookup_idx" ON "equipment" USING btree ("category","level","style");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_documents_source_key_idx" ON "knowledge_documents" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "knowledge_documents_embedding_idx" ON "knowledge_documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "rentals_equipment_period_idx" ON "rentals" USING btree ("equipment_id","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_auth_id_idx" ON "users" USING btree ("external_auth_id");