import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { MAX_MESSAGE_BODY, type AttachmentSummary, type ConversationType } from '@agora/shared';
import { Button, IconButton, Row, tokens, useToast } from '../../ds';
import { useWs } from '../../app/WsProvider';
import { uploadAttachment } from '../../features/attachments/useUpload';

export interface ReplyChip {
  id: string;
  author: string;
  body: string;
}

interface ComposerProps {
  conversationType: ConversationType;
  conversationId: string;
  /** Optional reply-to context; dismissible via the chip's × button. */
  replyTo?: ReplyChip | null;
  onClearReply?: () => void;
}

export const Composer = ({
  conversationType,
  conversationId,
  replyTo = null,
  onClearReply,
}: ComposerProps) => {
  const ws = useWs();
  const toast = useToast();
  const labelId = useId();
  const hintId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<AttachmentSummary[]>([]);
  const [uploading, setUploading] = useState(false);

  const ingest = async (file: File) => {
    if (pending.length >= 4) {
      toast.push({ tone: 'warn', body: 'up to 4 attachments per message' });
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadAttachment(file);
      setPending((prev) => [...prev, uploaded]);
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Upload failed',
        body: err instanceof Error ? err.message : 'could not upload',
      });
    } finally {
      setUploading(false);
    }
  };

  const onAttachChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    for (const f of files) await ingest(f);
    event.target.value = '';
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    const images: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) images.push(f);
      }
    }
    if (images.length > 0) {
      event.preventDefault();
      void Promise.all(images.map(ingest));
    }
  };

  const send = async () => {
    const trimmed = body.trim();
    if ((!trimmed && pending.length === 0) || !ws) return;
    setSending(true);
    // One UUID per user-intent-to-send. Reused across any retries because
    // it's captured into the payload before the await. See ADR-0006.
    const clientMessageId = crypto.randomUUID();
    try {
      await ws.request('message.send', {
        conversationType,
        conversationId,
        body: trimmed || '(attachment)',
        replyToId: replyTo?.id,
        attachmentIds: pending.map((p) => p.id),
        clientMessageId,
      });
      setBody('');
      setPending([]);
      onClearReply?.();
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Send failed',
        body: err instanceof Error ? err.message : 'could not send message',
      });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${tokens.color.rule}`,
        background: tokens.color.paper1,
        padding: '8px 12px',
      }}
    >
      {replyTo ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 6,
            padding: '4px 8px',
            background: tokens.color.paper2,
            borderLeft: `2px solid ${tokens.color.accent}`,
            borderRadius: tokens.radius.xs,
            fontFamily: tokens.type.mono,
            fontSize: 11,
            color: tokens.color.ink2,
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ↳ replying to{' '}
            <span style={{ color: tokens.color.ink0, fontWeight: 600 }}>{replyTo.author}</span>
            : {replyTo.body}
          </span>
          {onClearReply ? (
            <IconButton size={20} aria-label="Cancel reply" onClick={onClearReply}>
              ×
            </IconButton>
          ) : null}
        </div>
      ) : null}
      {pending.length > 0 ? (
        <Row gap={6} style={{ marginBottom: 6, flexWrap: 'wrap' }}>
          {pending.map((a) => {
            const kind = (a.mimeType.split('/')[1] ?? 'file').slice(0, 4).toUpperCase();
            return (
              <span
                key={a.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 6px',
                  border: `1px solid ${tokens.color.rule}`,
                  borderRadius: tokens.radius.xs,
                  background: tokens.color.paper0,
                  fontFamily: tokens.type.mono,
                  fontSize: 11,
                  color: tokens.color.ink1,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: tokens.type.mono,
                    fontSize: 10,
                    letterSpacing: 0.6,
                    color: tokens.color.ink2,
                    background: tokens.color.paper2,
                    padding: '0 4px',
                    borderRadius: tokens.radius.xs,
                  }}
                >
                  {kind}
                </span>
                {a.originalFilename}
                <IconButton
                  size={20}
                  aria-label={`Remove ${a.originalFilename}`}
                  onClick={() => setPending((prev) => prev.filter((p) => p.id !== a.id))}
                >
                  ×
                </IconButton>
              </span>
            );
          })}
        </Row>
      ) : null}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${tokens.color.rule}`,
          borderRadius: tokens.radius.xs,
        }}
      >
        <label htmlFor={labelId} className="sr-only">
          Message
        </label>
        <textarea
          id={labelId}
          aria-describedby={hintId}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Type a message…"
          rows={2}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: 10,
            fontFamily: tokens.type.mono,
            fontSize: 13,
            color: tokens.color.ink0,
            background: 'transparent',
          }}
        />
        <Row
          gap={6}
          style={{
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderTop: `1px solid ${tokens.color.paper2}`,
          }}
        >
          <Row gap={8} style={{ alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={onAttachChange}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pending.length >= 4}
              aria-label="Attach file"
            >
              Attach
            </Button>
            <span
              id={hintId}
              style={{ fontFamily: tokens.type.mono, fontSize: 12, color: tokens.color.ink2 }}
            >
              ⏎ send · ⇧⏎ newline · paste images
            </span>
          </Row>
          <Row gap={8} style={{ alignItems: 'center' }}>
            {body.length / MAX_MESSAGE_BODY > 0.8 ? (
              <span
                aria-live="polite"
                style={{
                  fontFamily: tokens.type.mono,
                  fontSize: 11,
                  color:
                    body.length > MAX_MESSAGE_BODY ? tokens.color.danger : tokens.color.ink2,
                }}
              >
                {body.length}/{MAX_MESSAGE_BODY}
              </span>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              pending={sending}
              disabled={
                (!body.trim() && pending.length === 0) ||
                uploading ||
                body.length > MAX_MESSAGE_BODY
              }
              onClick={send}
            >
              Send
            </Button>
          </Row>
        </Row>
      </div>
    </div>
  );
};
