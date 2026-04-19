/**
 * Drizzle schema mirroring docs/data-model.md. One file, grouped by section.
 * Identifiers use UUIDv7 for k-sortable ordering of rows by creation time.
 */

import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---- enums -----------------------------------------------------------------

export const roomVisibilityEnum = pgEnum('room_visibility', ['public', 'private']);
export const roomRoleEnum = pgEnum('room_role', ['owner', 'admin', 'member']);
export const conversationTypeEnum = pgEnum('conversation_type', ['room', 'dm']);

// ---- custom column type: bytea for fixed-length hashes ---------------------

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

// ---- users -----------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailKey: uniqueIndex('users_email_lower_key').on(sql`lower(${t.email})`),
    usernameKey: uniqueIndex('users_username_lower_key').on(sql`lower(${t.username})`),
    // Supports `lower(username) LIKE 'prefix%'` in user-search. The unique
    // index above covers equality but cannot serve LIKE prefix probes in the
    // default collation.
    usernameLowerPrefixIdx: index('users_username_lower_prefix_idx').on(
      sql`lower(${t.username}) text_pattern_ops`,
    ),
  }),
);

// ---- sessions --------------------------------------------------------------

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(t.expiresAt),
    // Unique index on token_hash — every auth'd request resolves the session
    // via this lookup. Without it Postgres does a seq scan per request.
    tokenHashKey: uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
  }),
);

// ---- password resets -------------------------------------------------------

export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => ({
    tokenKey: uniqueIndex('password_resets_token_hash_key').on(t.tokenHash),
    userIdIdx: index('password_resets_user_id_idx').on(t.userId),
  }),
);

// ---- friend requests & friendships ----------------------------------------

export const friendRequests = pgTable(
  'friend_requests',
  {
    id: uuid('id').primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    senderRecipientKey: uniqueIndex('friend_requests_sender_recipient_key').on(
      t.senderId,
      t.recipientId,
    ),
    recipientIdx: index('friend_requests_recipient_idx').on(t.recipientId),
    notSelf: check('friend_requests_not_self', sql`${t.senderId} <> ${t.recipientId}`),
  }),
);

export const friendships = pgTable(
  'friendships',
  {
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    establishedAt: timestamp('established_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userAId, t.userBId] }),
    order: check('friendships_a_lt_b', sql`${t.userAId} < ${t.userBId}`),
  }),
);

// ---- user bans (directional) ----------------------------------------------

export const userBans = pgTable(
  'user_bans',
  {
    bannerId: uuid('banner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bannerId, t.targetId] }),
    notSelf: check('user_bans_not_self', sql`${t.bannerId} <> ${t.targetId}`),
  }),
);

// ---- rooms -----------------------------------------------------------------

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    visibility: roomVisibilityEnum('visibility').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameLowerKey: uniqueIndex('rooms_name_lower_key').on(sql`lower(${t.name})`),
    ownerIdx: index('rooms_owner_idx').on(t.ownerId),
    visibilityIdx: index('rooms_visibility_idx').on(t.visibility),
  }),
);

export const roomMembers = pgTable(
  'room_members',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roomRoleEnum('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roomId, t.userId] }),
    ownerKey: uniqueIndex('room_members_one_owner_per_room')
      .on(t.roomId)
      .where(sql`${t.role} = 'owner'`),
    userIdx: index('room_members_user_idx').on(t.userId),
  }),
);

export const roomBans = pgTable(
  'room_bans',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bannerId: uuid('banner_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roomId, t.targetId] }),
  }),
);

export const roomInvitations = pgTable(
  'room_invitations',
  {
    id: uuid('id').primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePending: uniqueIndex('room_invitations_unique_pending').on(t.roomId, t.targetId),
    targetIdx: index('room_invitations_target_idx').on(t.targetId),
  }),
);

// ---- dm conversations ------------------------------------------------------

export const dmConversations = pgTable(
  'dm_conversations',
  {
    id: uuid('id').primaryKey(),
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pair: uniqueIndex('dm_conversations_pair_key').on(t.userAId, t.userBId),
    order: check('dm_conversations_a_lt_b', sql`${t.userAId} < ${t.userBId}`),
  }),
);

// ---- messages --------------------------------------------------------------

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey(),
    conversationType: conversationTypeEnum('conversation_type').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    replyToId: uuid('reply_to_id'),
    clientMessageId: uuid('client_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    conversationIdx: index('messages_conversation_idx').on(
      t.conversationType,
      t.conversationId,
      t.createdAt,
    ),
    // H3: cursor pagination + LATERAL preview sort by message.id, not
    // created_at. UUIDv7 keeps the two in the same order but the planner
    // still does a residual filter without this composite.
    conversationIdIdx: index('messages_conversation_id_idx').on(
      t.conversationType,
      t.conversationId,
      t.id,
    ),
    authorIdx: index('messages_author_idx').on(t.authorId),
    replyToIdx: index('messages_reply_to_idx')
      .on(t.replyToId)
      .where(sql`${t.replyToId} IS NOT NULL`),
    authorClientMsgKey: uniqueIndex('messages_author_client_msg_key')
      .on(t.authorId, t.clientMessageId)
      .where(sql`${t.clientMessageId} IS NOT NULL`),
  }),
);

// self-reference for replies is declared in relations, not as a drizzle FK
// (drizzle-orm has limited support for self-FKs in pgTable definitions in the
// current version; we enforce consistency at the application layer).

// ---- attachments -----------------------------------------------------------

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey(),
    uploaderId: uuid('uploader_id').references(() => users.id, { onDelete: 'set null' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    contentHash: bytea('content_hash').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    mimeType: text('mime_type').notNull(),
    originalFilename: text('original_filename').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    messageIdx: index('attachments_message_idx').on(t.messageId),
    hashIdx: index('attachments_content_hash_idx').on(t.contentHash),
  }),
);

// ---- last-read & unread counters ------------------------------------------

export const lastRead = pgTable(
  'last_read',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationType: conversationTypeEnum('conversation_type').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    lastReadMessageId: uuid('last_read_message_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.conversationType, t.conversationId] }),
  }),
);

export const conversationUnreads = pgTable(
  'conversation_unreads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationType: conversationTypeEnum('conversation_type').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.conversationType, t.conversationId] }),
  }),
);

// ---- notifications ---------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    payloadJson: text('payload_json').notNull().default('{}'),
    aggregateCount: integer('aggregate_count').notNull().default(1),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    feedIdx: index('notifications_feed_idx').on(t.userId, t.readAt, t.createdAt),
  }),
);

// ---- relations (optional but useful for joins) ----------------------------

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  ownedRooms: many(rooms),
  memberships: many(roomMembers),
}));

export const roomsRelations = relations(rooms, ({ many, one }) => ({
  owner: one(users, { fields: [rooms.ownerId], references: [users.id] }),
  members: many(roomMembers),
  bans: many(roomBans),
  invitations: many(roomInvitations),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(rooms, { fields: [roomMembers.roomId], references: [rooms.id] }),
  user: one(users, { fields: [roomMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
  attachments: many(attachments),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: 'replyTo',
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
  uploader: one(users, { fields: [attachments.uploaderId], references: [users.id] }),
}));

// ---- type exports ---------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
