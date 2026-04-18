/**
 * Attachment routes: upload, metadata lookup, authenticated download.
 *
 * Access control is enforced at every request (AC-6). Orphan attachments
 * (message_id NULL) are only visible to their uploader; attached ones reuse
 * the messaging permission helpers so room/DM access rules stay in one place.
 *
 * Multipart is registered inside the scoped plugin so `server.ts` stays
 * untouched — keeps cross-agent surface area small.
 */

import multipart from '@fastify/multipart';
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES } from '@agora/shared/attachments';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { attachments, messages } from '../db/schema.js';
import { canAccessDm, canAccessRoom } from '../messages/permissions.js';
import { addRouteModule } from '../routes/registry.js';
import { isAuthed, requireAuth } from '../session/require-auth.js';
import {
  deleteStoredFile,
  hashFromBuffer,
  hashToBuffer,
  openStoredFile,
  statStoredFile,
  writeStreamToStorage,
} from './storage.js';

const isImageMime = (mime: string): boolean => mime.toLowerCase().startsWith('image/');

interface AttachmentResponse {
  id: string;
  size: number;
  mimeType: string;
  originalFilename: string;
  comment: string | null;
}

const toResponse = (row: typeof attachments.$inferSelect): AttachmentResponse => ({
  id: row.id,
  size: row.size,
  mimeType: row.mimeType,
  originalFilename: row.originalFilename,
  comment: row.comment ?? null,
});

addRouteModule({
  name: 'attachments',
  register(app: FastifyInstance): void {
    app.register(async (scoped) => {
      await scoped.register(multipart, {
        limits: {
          fileSize: MAX_FILE_BYTES,
          files: 1,
          fields: 4,
        },
      });

      scoped.addHook('onRequest', requireAuth);

      // --- upload --------------------------------------------------------
      scoped.post('/api/attachments', async (req, reply) => {
        if (!isAuthed(req)) return;
        if (!req.isMultipart()) {
          return reply
            .code(400)
            .send({ error: 'validation', message: 'multipart/form-data required' });
        }

        const part = await req.file();
        if (!part) {
          return reply.code(400).send({ error: 'validation', message: 'no file part' });
        }

        const originalFilename = part.filename || 'unnamed';
        const mimeType = part.mimetype || 'application/octet-stream';
        const image = isImageMime(mimeType);
        const perFileCap = image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;

        const tempName = `${uuidv7()}.part`;
        let result: Awaited<ReturnType<typeof writeStreamToStorage>>;
        try {
          result = await writeStreamToStorage(part.file, tempName);
        } catch (err) {
          return reply.code(500).send({ error: 'internal', message: (err as Error).message });
        }

        if (part.file.truncated || result.size > perFileCap) {
          // multipart refused to buffer past fileSize or the image cap tripped.
          // If the bytes happen to be a duplicate we keep them on disk (some
          // other upload already earned them); otherwise purge what we just
          // wrote so disk doesn't grow with refused uploads.
          if (!result.deduped) {
            await deleteStoredFile(result.hash).catch(() => undefined);
          }
          return reply.code(413).send({
            error: 'too_large',
            code: image ? 'image_too_large' : 'file_too_large',
            message: image
              ? `image exceeds ${MAX_IMAGE_BYTES} bytes`
              : `file exceeds ${MAX_FILE_BYTES} bytes`,
          });
        }

        const commentField = part.fields['comment'];
        const commentRaw =
          commentField && !Array.isArray(commentField) && commentField.type === 'field'
            ? (commentField.value as unknown)
            : undefined;
        const comment =
          typeof commentRaw === 'string' && commentRaw.length > 0 ? commentRaw : null;

        const id = uuidv7();
        const [inserted] = await db
          .insert(attachments)
          .values({
            id,
            uploaderId: req.user.id,
            contentHash: hashToBuffer(result.hash),
            size: result.size,
            mimeType,
            originalFilename,
            comment,
          })
          .returning();

        if (!inserted) {
          return reply.code(500).send({ error: 'internal' });
        }

        return reply.code(201).send(toResponse(inserted));
      });

      // --- metadata ------------------------------------------------------
      scoped.get<{ Params: { id: string } }>('/api/attachments/:id', async (req, reply) => {
        if (!isAuthed(req)) return;
        const row = await loadAttachment(req.params.id);
        if (!row) return reply.code(404).send({ error: 'not_found' });

        const access = await checkAccess(row, req.user.id);
        if (!access.ok) {
          return reply.code(access.status).send({ error: access.code });
        }
        return reply.send(toResponse(row));
      });

      // --- download ------------------------------------------------------
      scoped.get<{ Params: { id: string } }>(
        '/api/attachments/:id/download',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const row = await loadAttachment(req.params.id);
          if (!row) return reply.code(404).send({ error: 'not_found' });

          const access = await checkAccess(row, req.user.id);
          if (!access.ok) {
            return reply.code(access.status).send({ error: access.code });
          }

          const hexHash = hashFromBuffer(row.contentHash);
          const onDisk = await statStoredFile(hexHash);
          if (!onDisk) {
            return reply.code(410).send({ error: 'gone', message: 'file missing on disk' });
          }

          reply
            .header('Content-Type', row.mimeType)
            .header('Content-Length', String(row.size))
            .header('Cache-Control', 'private, max-age=0, must-revalidate')
            .header(
              'Content-Disposition',
              `attachment; filename="${encodeRfc5987(row.originalFilename)}"`,
            );
          return reply.send(openStoredFile(hexHash));
        },
      );
    });
  },
});

const loadAttachment = async (
  id: string,
): Promise<typeof attachments.$inferSelect | null> => {
  const rows = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return rows[0] ?? null;
};

type AccessDecision = { ok: true } | { ok: false; status: 403 | 404; code: string };

export const checkAccess = async (
  row: typeof attachments.$inferSelect,
  userId: string,
): Promise<AccessDecision> => {
  if (row.messageId === null) {
    if (row.uploaderId !== userId) {
      return { ok: false, status: 403, code: 'forbidden' };
    }
    return { ok: true };
  }

  const [message] = await db
    .select({
      id: messages.id,
      conversationType: messages.conversationType,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(eq(messages.id, row.messageId))
    .limit(1);

  if (!message) {
    // Message row is gone — treat the attachment as orphaned. Only the
    // uploader retains visibility; everyone else gets 404 to avoid leaking
    // existence of the hash.
    if (row.uploaderId === userId) return { ok: true };
    return { ok: false, status: 404, code: 'not_found' };
  }

  const permission =
    message.conversationType === 'room'
      ? await canAccessRoom(userId, message.conversationId)
      : await canAccessDm(userId, message.conversationId);

  if (!permission.ok) {
    const status = permission.code === 'not_found' ? 404 : 403;
    return { ok: false, status, code: permission.code };
  }
  return { ok: true };
};

/**
 * RFC 5987 encoding for `Content-Disposition; filename="..."`. Keeps ASCII
 * printables as-is, escapes quotes and newlines, URL-encodes the rest.
 */
const encodeRfc5987 = (name: string): string =>
  name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\n\r]/g, ' ');
