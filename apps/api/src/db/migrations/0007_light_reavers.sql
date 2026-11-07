CREATE TABLE "foreshadows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"planted_episode_id" uuid,
	"resolved_episode_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foreshadows" ADD CONSTRAINT "foreshadows_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadows" ADD CONSTRAINT "foreshadows_planted_episode_id_episodes_id_fk" FOREIGN KEY ("planted_episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadows" ADD CONSTRAINT "foreshadows_resolved_episode_id_episodes_id_fk" FOREIGN KEY ("resolved_episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foreshadows_work_idx" ON "foreshadows" USING btree ("work_id");