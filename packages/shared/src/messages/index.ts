import { z } from 'zod';
import { userPublic } from '../users/index.js';

export const conversationType = z.enum(['room', 'dm']);
export type ConversationType = z.infer<typeof conversationType>;

// FR-MSG-3: max 3 KB per message, UTF-8 only. The 3072-char soft cap
// catches naive over-length strings fast, but we also enforce the real
// byte budget because a user can fit far more than 3 KB in 3072 multi-
// byte emoji. TextEncoder is available in Node and every modern browser.
export const MAX_MESSAGE_BODY = 3072;

export const messageBodySchema = z
  .string()
  .min(1)
  .max(MAX_MESSAGE_BODY)
  .refine(
    (s) => new TextEncoder().encode(s).byteLength <= 3 * 1024,
    { message: 'message body exceeds 3 KB UTF-8' },
  );

export const attachmentSummary = z.object({
  id: z.string().uuid(),
  size: z.number().int().nonnegative(),
  mimeType: z.string(),
  originalFilename: z.string(),
  comment: z.string().nullable(),
});
export type AttachmentSummary = z.infer<typeof attachmentSummary>;

export const messageView = z.object({
  id: z.string().uuid(),
  conversationType,
  conversationId: z.string().uuid(),
  author: userPublic.nullable(),
  body: z.string(),
  replyToId: z.string().uuid().nullable(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  attachments: z.array(attachmentSummary),
});
export type MessageView = z.infer<typeof messageView>;

export const sendMessagePayload = z.object({
  conversationType,
  conversationId: z.string().uuid(),
  body: messageBodySchema,
  replyToId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).max(4).optional(),
});
export type SendMessagePayload = z.infer<typeof sendMessagePayload>;

export const editMessagePayload = z.object({
  id: z.string().uuid(),
  body: messageBodySchema,
});
export type EditMessagePayload = z.infer<typeof editMessagePayload>;

export const deleteMessagePayload = z.object({
  id: z.string().uuid(),
});
export type DeleteMessagePayload = z.infer<typeof deleteMessagePayload>;

export const markReadPayload = z.object({
  conversationType,
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});
export type MarkReadPayload = z.infer<typeof markReadPayload>;
