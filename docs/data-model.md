# Data model

Postgres 16. Every row has a UUIDv7 primary key unless stated otherwise. Every table has `created_at` / `updated_at timestamptz` unless stated. `timestamptz` throughout (never naive `timestamp`).

## ERD (ASCII)

```
                    ┌───────────────┐
                    │     users     │
                    └──────┬────────┘
                           │
       ┌───────────────────┼────────────────────────────────┐
       │                   │                                │
┌──────▼──────┐   ┌────────▼────────┐             ┌────────▼────────┐
│  sessions   │   │  friendships    │             │ password_resets │
└─────────────┘   └─────────────────┘             └─────────────────┘
                          │
                    ┌─────▼────────┐           ┌──────────────┐
                    │  user_bans   │           │    rooms     │
                    └──────────────┘           └──────┬───────┘
                                                      │
                               ┌──────────────────────┼──────────────────────┐
                               │                      │                      │
                       ┌───────▼────────┐     ┌───────▼────────┐     ┌───────▼────────┐
                       │ room_members   │     │ room_bans      │     │ room_invites   │
                       └────────────────┘     └────────────────┘     └────────────────┘

┌─────────────────────┐
│ dm_conversations    │
└─────────┬───────────┘
          │
          │             ┌─────────────────┐
          └────────────►│    messages     │
                        └───────┬─────────┘
                                │
                          ┌─────▼─────────┐         ┌────────────────┐
                          │ attachments   │         │ friend_requests│
                          └───────────────┘         └────────────────┘

┌─────────────────────┐          ┌─────────────────────┐
│ conversation_unreads│          │ last_read           │
└─────────────────────┘          └─────────────────────┘
```

## Conventions

- IDs: UUIDv7 from `uuidv7` npm package. k-sortable by creation time.
- Soft delete: messages have `deleted_at`; everything else is hard delete.
- Enums: Postgres native enums, defined in Drizzle schema. Changes go through migrations.
- Foreign keys: `ON DELETE CASCADE` where it matches product behaviour (room → memberships), `ON DELETE SET NULL` where the row survives its parent (messages → users), `ON DELETE NO ACTION` where manual cleanup is required.
- Case: `snake_case` column names, `plural` table names.
- Timestamps: all `timestamptz`, default `now()` on insert.

## Tables

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | UUIDv7 |
| `email` | citext UNIQUE NOT NULL | case-insensitive |
| `username` | citext UNIQUE NOT NULL | case-insensitive, immutable, JID-safe `[a-z0-9._-]{3,32}`, must start with letter |
| `password_hash` | text NOT NULL | argon2id-encoded |
| `deleted_at` | timestamptz | set on account deletion; user row survives for message-attribution until no references remain |
| `created_at`, `updated_at` | timestamptz | |

**Indexes**: unique on `email`, unique on `username`.

### `sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | session id (opaque); hashed before storage |
| `user_id` | uuid FK → users(id) ON DELETE CASCADE | |
| `token_hash` | bytea NOT NULL | SHA-256 of the random token issued in cookie |
| `user_agent` | text | raw string |
| `ip` | inet | v4 or v6 |
| `created_at`, `last_seen_at`, `expires_at` | timestamptz | sliding expiry, 14d from `last_seen_at` |

**Indexes**: btree on `user_id`, btree on `expires_at` (for the pruner).

### `password_resets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users(id) ON DELETE CASCADE | |
| `token_hash` | bytea NOT NULL UNIQUE | SHA-256 of token |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | 30 min |
| `consumed_at` | timestamptz NULL | set on consume |

### `friend_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sender_id` | uuid FK → users ON DELETE CASCADE | |
| `recipient_id` | uuid FK → users ON DELETE CASCADE | |
| `note` | text | optional |
| `created_at` | timestamptz | |

**Constraint**: `UNIQUE (sender_id, recipient_id)`. No reflexive rows (`CHECK sender_id <> recipient_id`).

### `friendships`

| Column | Type | Notes |
|---|---|---|
| `user_a_id` | uuid FK → users | always the lexicographically-smaller UUID |
| `user_b_id` | uuid FK → users | always the larger |
| `established_at` | timestamptz | |

**PK**: `(user_a_id, user_b_id)`. **Constraint**: `CHECK user_a_id < user_b_id`.

### `user_bans`

Directional; A banning B is distinct from B banning A.

| Column | Type | Notes |
|---|---|---|
| `banner_id` | uuid FK → users ON DELETE CASCADE | |
| `target_id` | uuid FK → users ON DELETE CASCADE | |
| `reason` | text NULL | optional |
| `created_at` | timestamptz | |

**PK**: `(banner_id, target_id)`. **Constraint**: `CHECK banner_id <> target_id`.

### `rooms`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | citext UNIQUE NOT NULL | globally unique, public + private |
| `description` | text | |
| `visibility` | room_visibility NOT NULL | enum: `public`, `private` |
| `owner_id` | uuid FK → users(id) ON DELETE CASCADE | cascades: owner deletion deletes the room |
| `created_at`, `updated_at` | timestamptz | |

**Indexes**: unique on `name`, btree on `owner_id`, btree on `visibility`.

### `room_members`

| Column | Type | Notes |
|---|---|---|
| `room_id` | uuid FK → rooms ON DELETE CASCADE | |
| `user_id` | uuid FK → users ON DELETE CASCADE | |
| `role` | room_role NOT NULL | enum: `owner`, `admin`, `member` |
| `joined_at` | timestamptz | |

**PK**: `(room_id, user_id)`. **Constraint**: unique partial index — at most one `owner` row per room: `CREATE UNIQUE INDEX ON room_members (room_id) WHERE role = 'owner'`.

### `room_bans`

| Column | Type | Notes |
|---|---|---|
| `room_id` | uuid FK → rooms ON DELETE CASCADE | |
| `target_id` | uuid FK → users ON DELETE CASCADE | |
| `banner_id` | uuid FK → users ON DELETE SET NULL | preserved even if banner leaves |
| `reason` | text | |
| `created_at` | timestamptz | |

**PK**: `(room_id, target_id)`.

### `room_invitations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `room_id` | uuid FK → rooms ON DELETE CASCADE | |
| `target_id` | uuid FK → users ON DELETE CASCADE | |
| `inviter_id` | uuid FK → users ON DELETE SET NULL | |
| `created_at` | timestamptz | |

**Indexes**: btree on `target_id`, unique `(room_id, target_id)` partial index (no duplicate pending invites).

### `dm_conversations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_a_id` | uuid FK → users ON DELETE CASCADE | smaller UUID |
| `user_b_id` | uuid FK → users ON DELETE CASCADE | larger UUID |
| `created_at` | timestamptz | |

**Constraint**: `CHECK user_a_id < user_b_id`. **Index**: unique `(user_a_id, user_b_id)`.

### `messages`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | UUIDv7 — k-sortable |
| `conversation_type` | conversation_type NOT NULL | enum: `room`, `dm` |
| `conversation_id` | uuid NOT NULL | FK depends on type; no SQL-level FK (polymorphic) |
| `author_id` | uuid FK → users ON DELETE SET NULL | deleted users' messages persist with null author |
| `body` | text NOT NULL | ≤3 KB enforced at API level; no DB CHECK because UTF-8 byte counting in SQL is awkward |
| `reply_to_id` | uuid FK → messages(id) ON DELETE SET NULL | |
| `created_at` | timestamptz NOT NULL | |
| `edited_at` | timestamptz NULL | set on edit |
| `deleted_at` | timestamptz NULL | soft delete; body cleared when set |

**Indexes**: btree `(conversation_type, conversation_id, created_at DESC)` — the main history scan. btree `(author_id)` for "my messages" queries if we add them later.

### `attachments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `uploader_id` | uuid FK → users ON DELETE SET NULL | |
| `message_id` | uuid FK → messages ON DELETE SET NULL | nullable until attached |
| `content_hash` | bytea NOT NULL | SHA-256 of file bytes, 32 bytes |
| `size` | bigint NOT NULL | |
| `mime_type` | text NOT NULL | |
| `original_filename` | text NOT NULL | |
| `comment` | text NULL | per FR-ATT-4 |
| `created_at` | timestamptz | |

**Indexes**: btree on `message_id`, btree on `content_hash` (for dedupe + cleanup).

### `last_read`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid FK → users ON DELETE CASCADE | |
| `conversation_type` | conversation_type NOT NULL | |
| `conversation_id` | uuid NOT NULL | |
| `last_read_message_id` | uuid | may reference a soft-deleted message |
| `updated_at` | timestamptz | |

**PK**: `(user_id, conversation_type, conversation_id)`.

### `conversation_unreads`

Denormalised counter for cheap sidebar rendering.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid FK → users ON DELETE CASCADE | |
| `conversation_type` | conversation_type NOT NULL | |
| `conversation_id` | uuid NOT NULL | |
| `count` | integer NOT NULL DEFAULT 0 | |

**PK**: `(user_id, conversation_type, conversation_id)`. Maintained by application code: incremented in the same tx as a `message_new`, reset on `mark_read`.

## Invariants

These should be enforced as CHECK constraints, unique partial indexes, or transactional code. Pick the cheapest that works.

1. **One owner per room** — unique partial index on `room_members(room_id) WHERE role='owner'`.
2. **Owner always has a membership row** — enforced by route code; creating a room inserts the owner membership atomically.
3. **No self-friend-request** — `CHECK sender_id <> recipient_id` on `friend_requests`.
4. **No self-friendship** — `CHECK user_a_id < user_b_id` on `friendships`.
5. **No self-ban** — `CHECK banner_id <> target_id` on `user_bans`.
6. **Room name uniqueness is global** — unique index on `rooms(name)`.
7. **Attachment size limits** — enforced at the upload route, not the DB.

## Enums

```sql
CREATE TYPE room_visibility AS ENUM ('public', 'private');
CREATE TYPE room_role       AS ENUM ('owner', 'admin', 'member');
CREATE TYPE conversation_type AS ENUM ('room', 'dm');
```

## Notes on deletion cascades

- **User deletion** — User's *owned* rooms cascade (messages in those rooms and their attachments go with them). User's memberships in other rooms cascade out (they're removed). User's messages in other rooms have `author_id` SET NULL and remain visible. User's sessions, friend requests, bans, invitations all cascade.
- **Room deletion** — Messages in that room cascade; attachments on those messages cascade. Files on disk are scheduled for deletion by a follow-up worker (not in the same transaction so we don't hold a DB lock during file I/O).
- **Message deletion** — Soft delete only. Attachments are *disattached* (message_id set null, they become orphans) and pruned by the sweep.

## Migration sequencing

One migration per logical change. Migrations live under `apps/api/src/db/migrations/` (drizzle-kit generates them). Initial migration sets up all tables at once; feature-specific additions go into numbered migrations.
