# Attachments

## Scope

FR-ATT-1 to FR-ATT-7, NFR-FILE-1 to NFR-FILE-3.

## Definition of done

Users can attach images and arbitrary files to messages by explicit upload or clipboard paste, up to 20 MB (3 MB for images). Files are stored on a container-mounted volume at a content-addressed path, accessed only through authenticated endpoints that check current room/dialog membership at the time of request. Files remain on disk after the uploader loses access; they are deleted only when the containing room is deleted.

## Acceptance criteria

- **Upload endpoint** — `POST /api/attachments` multipart/form-data with a single file + optional `comment` form field. Streams the file to disk with a SHA-256 content hash as the filename under `/data/attachments/<hash[0:2]>/<hash[2:4]>/<hash>`. Returns the attachment id, size, mime type, original filename, preview hint for images.
- **Size limits** — Server rejects files larger than 20 MB, images larger than 3 MB. Pre-upload the UI displays the limits; the server enforces them as the source of truth.
- **Image detection** — `mime/.startsWith('image/')` classifies as image for the 3 MB threshold; anything else is a file at 20 MB.
- **Attach to message** — On `message_send`, up to N (default 4) attachment ids may be listed in `attachment_ids`. Server validates that the caller uploaded each attachment in this session (ownership + reasonable TTL) and that none are already attached elsewhere.
- **Pasting** — Clipboard paste (an `onPaste` handler on the composer) detects image data and uploads it transparently. Non-image file paste behaviour: defer to browser drag-drop / upload-button pathway, not paste.
- **Comment** — Optional text attached to the attachment itself (FR-ATT-4), separate from the message body.
- **Original filename preserved** — The download response uses `Content-Disposition: attachment; filename="<original>"`.
- **Download endpoint** — `GET /api/attachments/:id/download` checks at request time: (a) caller authenticated; (b) caller is a current member of the containing conversation (or an authorised participant if it's a dm). If no, 403. If yes, stream the file from disk.
- **Access loss** — If the caller is removed/banned/account-deleted between upload and download, the download request returns 403. The file itself is not deleted.
- **Room deletion cascades bytes** — On room deletion, enqueue each attachment's file path for deletion. Async worker (or a simple follow-up loop) deletes the bytes after the DB transaction commits.
- **Orphaned uploads** — Attachments uploaded but never attached to a message are pruned by a periodic sweep (every 15 minutes in MVP) if older than 1 hour.
- **Deduplication (optional hardening)** — If the content hash already exists on disk, reuse it (increment ref count). MVP may skip the ref count and just never delete bytes unless the ref is the last.

## Out of scope

- Antivirus scanning.
- Content-type sniffing beyond the upload's declared MIME (rely on the browser + `mime-types` library).
- Thumbnails / image resizing for preview.
- Cloud storage (S3, GCS) — local FS only per NFR-FILE-1.
- Presigned URLs — access control is always checked at the API layer.
- Range / resumable uploads.

## Implementation hints

- Use `@fastify/multipart` with `limits: { fileSize: 20 * 1024 * 1024 }`. For images, validate after the first chunk confirms `mimetype`.
- Storage root is `/data/attachments` inside the container, mounted from `./storage/attachments` on the host. The volume must survive compose restarts but is *not* committed to git.
- Path shape `<hash[0:2]>/<hash[2:4]>/<hash>` keeps per-directory entry counts bounded at ~65k max.
- `attachments` table: id, uploader_id, content_hash, size, mime_type, original_filename, comment, created_at, message_id (nullable until attached).
- When streaming downloads, set `Content-Type` from the stored mime_type, `Content-Length` from the stored size, and a non-cacheable `Cache-Control: private, max-age=0, must-revalidate` because access may be revoked at any time.

## Open questions

- [ ] Do we want a per-user storage quota? Not in MVP; file cap alone is the backstop.
- [ ] Should the upload endpoint be tied to a specific conversation up-front, or is upload-then-attach the right flow? Going with upload-then-attach so paste and attach-button share a single pathway; server validates ownership on `message_send`.
