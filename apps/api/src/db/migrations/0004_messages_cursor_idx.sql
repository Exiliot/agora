-- H3: cursor pagination on messages filters by id after
-- (conversation_type, conversation_id). The existing messages_conversation_idx
-- is keyed on created_at, so pagination pays a residual filter. A composite
-- on (conversation_type, conversation_id, id) turns history fetches and the
-- LATERAL preview lookup into a clean index-only range scan.
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" USING btree ("conversation_type","conversation_id","id");--> statement-breakpoint
-- M10: support reply lookups once replies surface in UI. Without it every
-- "find replies to message" query is a seq scan.
CREATE INDEX IF NOT EXISTS "messages_reply_to_idx" ON "messages" USING btree ("reply_to_id") WHERE "reply_to_id" IS NOT NULL;--> statement-breakpoint
-- M7: user-search uses `lower(username) LIKE 'prefix%'`. The existing
-- users_username_lower_key unique index can't serve prefix matches in the
-- default collation. text_pattern_ops enables LIKE prefix scans.
CREATE INDEX IF NOT EXISTS "users_username_lower_prefix_idx" ON "users" USING btree (lower(username) text_pattern_ops);
