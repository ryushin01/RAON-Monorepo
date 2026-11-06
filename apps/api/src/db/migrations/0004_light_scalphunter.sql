CREATE TYPE "public"."note_kind" AS ENUM('SETTING', 'MEMO');--> statement-breakpoint
CREATE TABLE "work_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"episode_id" uuid,
	"kind" "note_kind" NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_notes" ADD CONSTRAINT "work_notes_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_notes" ADD CONSTRAINT "work_notes_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_notes_work_idx" ON "work_notes" USING btree ("work_id","kind");