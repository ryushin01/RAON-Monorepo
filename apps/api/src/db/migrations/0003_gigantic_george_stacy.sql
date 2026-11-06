CREATE TYPE "public"."episode_version_kind" AS ENUM('AUTO', 'MANUAL');--> statement-breakpoint
CREATE TABLE "episode_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"kind" "episode_version_kind" NOT NULL,
	"label" text,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"author_note" text,
	"char_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_versions" ADD CONSTRAINT "episode_versions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_versions_episode_created_idx" ON "episode_versions" USING btree ("episode_id","created_at");