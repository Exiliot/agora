import { useEffect, useRef, useState } from 'react';
import type { AttachmentSummary, ConversationType, MessageView, RoomRole } from '@agora/shared';
import { FileCard, MessageRow, colorForName, tokens } from '../../ds';
import { useMessages } from '../../features/messages/useMessages';
import { useMe } from '../../features/auth/useMe';
import { useWs } from '../../app/WsProvider';
import { useLastSeenStore } from '../../features/messages/lastSeen';

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
  /** My role in the room — used to determine if I can delete others' messages. */
  myRoomRole?: RoomRole | null;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const MessageActions = ({
  msg,
  canEdit,
  canDelete,
}: {
  msg: MessageView;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const ws = useWs();
  if (!canEdit && !canDelete) return null;
  const handleEdit = async () => {
    const next = window.prompt('Edit message', msg.body);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === msg.body) return;
    await ws?.request('message.edit', { id: msg.id, body: trimmed });
  };
  const handleDelete = async () => {
    if (!window.confirm('Delete this message?')) return;
    await ws?.request('message.delete', { id: msg.id });
  };
  return (
    <span
      className="msg-actions"
      style={{
        marginLeft: 8,
        fontFamily: tokens.type.mono,
        fontSize: 11,
        color: tokens.color.ink3,
        display: 'inline-flex',
        gap: 6,
      }}
    >
      {canEdit ? (
        <button
          type="button"
          onClick={handleEdit}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tokens.color.ink2,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: 0,
          }}
        >
          edit
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={handleDelete}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tokens.color.danger,
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: 0,
          }}
        >
          delete
        </button>
      ) : null}
    </span>
  );
};

export const MessageList = ({ conversationType, conversationId, myRoomRole }: MessageListProps) => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(
    conversationType,
    conversationId,
  );
  const { data: me } = useMe();
  const ref = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Initial scroll-to-bottom when opening a conversation.
  useEffect(() => {
    if (data && ref.current && !didInitialScroll.current[conversationId]) {
      ref.current.scrollTop = ref.current.scrollHeight;
      didInitialScroll.current[conversationId] = true;
    }
  }, [data, conversationId]);

  // Auto-load older messages when the top sentinel comes into view.
  useEffect(() => {
    const scroller = ref.current;
    const sentinel = topSentinel.current;
    if (!scroller || !sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          // Remember the current scrollHeight so we can restore position after load.
          const prevHeight = scroller.scrollHeight;
          const prevTop = scroller.scrollTop;
          void fetchNextPage().then(() => {
            requestAnimationFrame(() => {
              if (!scroller) return;
              const delta = scroller.scrollHeight - prevHeight;
              scroller.scrollTop = prevTop + delta;
            });
          });
        }
      },
      { root: scroller, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  const messages: MessageView[] = (data?.pages ?? [])
    .flatMap((page) => page.messages)
    .slice()
    .reverse();

  const latestId = messages.length > 0 ? messages[messages.length - 1]?.id : undefined;
  useEffect(() => {
    if (latestId) useLastSeenStore.getState().note(conversationType, conversationId, latestId);
  }, [latestId, conversationType, conversationId]);

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: tokens.color.ink3, fontFamily: tokens.type.mono, fontSize: 12 }}>
        loading…
      </div>
    );
  }

  const canModerate = myRoomRole === 'owner' || myRoomRole === 'admin';

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
      <div ref={topSentinel} />
      {hasNextPage ? (
        <div
          style={{
            margin: '8px auto',
            display: 'block',
            textAlign: 'center',
            fontFamily: tokens.type.mono,
            fontSize: 11,
            color: tokens.color.ink3,
          }}
        >
          {isFetchingNextPage ? 'loading older…' : 'scroll up for older messages'}
        </div>
      ) : messages.length > 0 ? (
        <div
          style={{
            margin: '8px auto',
            textAlign: 'center',
            fontFamily: tokens.type.mono,
            fontSize: 11,
            color: tokens.color.ink3,
          }}
        >
          — beginning of conversation —
        </div>
      ) : null}
      {messages.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: tokens.color.ink3, fontSize: 12 }}>
          no messages yet — say hello
        </div>
      ) : (
        messages.map((msg) => {
          const isMine = Boolean(me && msg.author?.id === me.id);
          const deleted = Boolean(msg.deletedAt);
          const canEdit = isMine && !deleted;
          const canDelete = !deleted && (isMine || canModerate);
          const showActions = hoveredId === msg.id;
          return (
            <div
              key={msg.id}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId((prev) => (prev === msg.id ? null : prev))}
            >
              <MessageRow
                time={formatTime(msg.createdAt)}
                user={msg.author?.username ?? 'deleted-user'}
                color={colorForName(msg.author?.username ?? '?')}
                deleted={deleted}
              >
                {msg.body !== '(attachment)' || msg.attachments.length === 0 ? msg.body : ''}
                {msg.editedAt ? (
                  <span style={{ color: tokens.color.ink3, fontSize: 11, marginLeft: 6 }}>
                    (edited)
                  </span>
                ) : null}
                {showActions ? (
                  <MessageActions msg={msg} canEdit={canEdit} canDelete={canDelete} />
                ) : null}
                {msg.attachments.length > 0 ? (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {msg.attachments.map((a) => (
                      <AttachmentPreview key={a.id} attachment={a} />
                    ))}
                  </div>
                ) : null}
              </MessageRow>
            </div>
          );
        })
      )}
    </div>
  );
};
