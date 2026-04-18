CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"actor_user_id" uuid,
	"payload_json" text NOT NULL DEFAULT '{}',
	"aggregate_count" integer NOT NULL DEFAULT 1,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_feed_idx" ON "notifications" USING btree ("user_id","read_at","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_unread_collapse_key" ON "notifications" USING btree ("user_id","kind","subject_type","subject_id") WHERE "read_at" IS NULL;
