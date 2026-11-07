CREATE TYPE "public"."work_format" AS ENUM('COMIC', 'NOVEL');--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "format" "work_format" DEFAULT 'NOVEL' NOT NULL;--> statement-breakpoint
CREATE INDEX "works_format_idx" ON "works" USING btree ("format");