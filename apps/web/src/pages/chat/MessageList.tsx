import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AttachmentSummary, ConversationType, MessageView, RoomRole } from '@agora/shared';
import { Button, FileCard, MessageRow, colorForName, tokens, useToast } from '../../ds';
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
  const toast = useToast();
  if (!canEdit && !canDelete) return null;
  const handleEdit = async () => {
    const next = window.prompt('Edit message', msg.body);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === msg.body) return;
    try {
      await ws?.request('message.edit', { id: msg.id, body: trimmed });
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Edit failed',
        body: err instanceof Error ? err.message : 'could not edit message',
      });
    }
  };
  const handleDelete = async () => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await ws?.request('message.delete', { id: msg.id });
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Delete failed',
        body: err instanceof Error ? err.message : 'could not delete message',
      });
    }
  };
  return (
    <span
      style={{
        marginLeft: 8,
        fontFamily: tokens.type.mono,
        fontSize: 11,
        display: 'inline-flex',
        gap: 8,
      }}
    >
      {canEdit ? (
        <Button variant="link" size="sm" onClick={handleEdit} style={{ fontSize: 11 }}>
          edit
        </Button>
      ) : null}
      {canDelete ? (
        <Button variant="linkDanger" size="sm" onClick={handleDelete} style={{ fontSize: 11 }}>
          delete
        </Button>
      ) : null}
    </span>
  );
};

const MessageItem = ({
  msg,
  isMine,
  canModerate,
  hovered,
  onEnter,
  onLeave,
}: {
  msg: MessageView;
  isMine: boolean;
  canModerate: boolean;
  hovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) => {
  const deleted = Boolean(msg.deletedAt);
  const canEdit = isMine && !deleted;
  const canDelete = !deleted && (isMine || canModerate);
  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <MessageRow
        time={formatTime(msg.createdAt)}
        user={msg.author?.username ?? 'deleted-user'}
        color={colorForName(msg.author?.username ?? '?')}
        deleted={deleted}
      >
        {msg.body !== '(attachment)' || msg.attachments.length === 0 ? msg.body : ''}
        {msg.editedAt ? (
          <span style={{ color: tokens.color.ink3, fontSize: 11, marginLeft: 6 }}>(edited)</span>
        ) : null}
        {hovered ? <MessageActions msg={msg} canEdit={canEdit} canDelete={canDelete} /> : null}
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
};

export const MessageList = ({ conversationType, conversationId, myRoomRole }: MessageListProps) => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(
    conversationType,
    conversationId,
  );
  const { data: me } = useMe();
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const messages: MessageView[] = useMemo(
    () =>
      (data?.pages ?? [])
        .flatMap((page) => page.messages)
        .slice()
        .reverse(),
    [data],
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 12,
    // Rows vary in height (attachments, long text). Measure on mount so the
    // virtualiser's offsets are accurate and scroll is smooth.
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  // Initial scroll-to-bottom when a conversation opens.
  useEffect(() => {
    if (!data || !scrollRef.current || didInitialScroll.current[conversationId]) return;
    if (messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    didInitialScroll.current[conversationId] = true;
  }, [data, conversationId, messages.length, virtualizer]);

  // Record the latest visible id into the watermark store so WS reconnects
  // can backfill from it.
  const latestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (latestId) useLastSeenStore.getState().note(conversationType, conversationId, latestId);
  }, [latestId, conversationType, conversationId]);

  // Auto-load older messages when the top sentinel scrolls into view.
  // Scroll position is preserved by remembering the current scrollHeight and
  // restoring scrollTop + (newHeight - oldHeight) once the fetch resolves.
  useEffect(() => {
    const scroller = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!scroller || !sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isFetchingNextPage) return;
        const prevHeight = scroller.scrollHeight;
        const prevTop = scroller.scrollTop;
        void fetchNextPage().then(() => {
          requestAnimationFrame(() => {
            if (!scrollRef.current) return;
            const delta = scrollRef.current.scrollHeight - prevHeight;
            scrollRef.current.scrollTop = prevTop + delta;
          });
        });
      },
      { root: scroller, rootMargin: '400px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <div
        style={{
          padding: 16,
          color: tokens.color.ink3,
          fontFamily: tokens.type.mono,
          fontSize: 12,
        }}
      >
        loading…
      </div>
    );
  }

  const canModerate = myRoomRole === 'owner' || myRoomRole === 'admin';
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={scrollRef}
      data-testid="message-scroller"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Message history"
      style={{
        flex: 1,
        overflowY: 'auto',
        background: '#fff',
      }}
    >
      <div ref={topSentinelRef} />
      {hasNextPage ? (
        <div
          style={{
            padding: '6px 0',
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
            padding: '6px 0',
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
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: tokens.color.ink3,
            fontSize: 12,
          }}
        >
          no messages yet — say hello
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: totalSize,
          }}
        >
          {virtualItems.map((vi) => {
            const msg = messages[vi.index];
            if (!msg) return null;
            const isMine = Boolean(me && msg.author?.id === me.id);
            return (
              <div
                key={msg.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <MessageItem
                  msg={msg}
                  isMine={isMine}
                  canModerate={canModerate}
                  hovered={hoveredId === msg.id}
                  onEnter={() => setHoveredId(msg.id)}
                  onLeave={() => setHoveredId((prev) => (prev === msg.id ? null : prev))}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
