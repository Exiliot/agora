import { useEffect, useRef } from 'react';
import type { AttachmentSummary, ConversationType, MessageView } from '@agora/shared';
import { FileCard, MessageRow, colorForName, tokens } from '../../ds';
import { useMessages } from '../../features/messages/useMessages';

const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentPreview = ({ attachment }: { attachment: AttachmentSummary }) => {
  const isImage = attachment.mimeType.startsWith('image/');
  const href = `/api/attachments/${attachment.id}/download`;
  const kind = attachment.mimeType.split('/')[1]?.slice(0, 4) ?? 'file';
  return (
    <FileCard
      name={attachment.originalFilename}
      size={humanSize(attachment.size)}
      kind={kind}
      image={isImage}
      href={href}
      {...(attachment.comment ? { comment: attachment.comment } : {})}
    />
  );
};

interface MessageListProps {
  conversationType: ConversationType;
  conversationId: string;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export const MessageList = ({ conversationType, conversationId }: MessageListProps) => {
  const { data, isLoading, fetchNextPage, hasNextPage } = useMessages(
    conversationType,
    conversationId,
  );
  const ref = useRef<HTMLDivElement>(null);

  // Scroll to bottom on initial load.
  useEffect(() => {
    if (data && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [data, conversationId]);

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: tokens.color.ink3, fontFamily: tokens.type.mono, fontSize: 12 }}>
        loading…
      </div>
    );
  }

  // Pages are in reverse chronological order per page; flatten and reverse for display.
  const messages: MessageView[] = (data?.pages ?? [])
    .flatMap((page) => page.messages)
    .slice()
    .reverse();

  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0',
        background: '#fff',
      }}
    >
      {hasNextPage ? (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          style={{
            margin: '8px auto',
            display: 'block',
            fontFamily: tokens.type.mono,
            fontSize: 11,
            color: tokens.color.ink2,
            background: 'transparent',
            border: `1px dashed ${tokens.color.rule}`,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          load older
        </button>
      ) : null}
      {messages.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: tokens.color.ink3, fontSize: 12 }}>
          no messages yet — say hello
        </div>
      ) : (
        messages.map((msg) => (
          <MessageRow
            key={msg.id}
            time={formatTime(msg.createdAt)}
            user={msg.author?.username ?? 'deleted-user'}
            color={colorForName(msg.author?.username ?? '?')}
            deleted={Boolean(msg.deletedAt)}
          >
            {msg.body !== '(attachment)' || msg.attachments.length === 0 ? msg.body : ''}
            {msg.editedAt ? (
              <span style={{ color: tokens.color.ink3, fontSize: 11, marginLeft: 6 }}>(edited)</span>
            ) : null}
            {msg.attachments.length > 0 ? (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {msg.attachments.map((a) => (
                  <AttachmentPreview key={a.id} attachment={a} />
                ))}
              </div>
            ) : null}
          </MessageRow>
        ))
      )}
    </div>
  );
};
