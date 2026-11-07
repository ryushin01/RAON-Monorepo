CREATE TYPE "public"."episode_type" AS ENUM('REGULAR', 'PROLOGUE', 'EPILOGUE', 'SIDE', 'NOTICE');--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "episode_type" "episode_type" DEFAULT 'REGULAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "point_of_view" text DEFAULT '' NOT NULL;