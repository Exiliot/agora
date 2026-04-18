import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AttachmentSummary, ConversationType, MessageView, RoomRole } from '@agora/shared';
import {
  Button,
  Col,
  FileCard,
  MessageRow,
  Modal,
  ModalScrim,
  Row,
  colorForName,
  tokens,
  useToast,
} from '../../ds';
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

const localDateKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
    .getDate()
    .toString()
    .padStart(2, '0')}`;
};

const formatDateLabel = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (sameDay) return 'Today';
  if (sameYesterday) return 'Yesterday';
  // Mon 14 Apr 2026 · keeps it mono-friendly and unambiguous
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const DaySeparator = ({ iso }: { iso: string }) => (
  <div
    role="separator"
    aria-label={formatDateLabel(iso)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 16px 6px',
      fontFamily: tokens.type.mono,
      fontSize: 11,
      color: tokens.color.ink2,
      letterSpacing: 0.2,
    }}
  >
    <span style={{ flex: 1, height: 1, background: tokens.color.rule }} aria-hidden="true" />
    <span style={{ flexShrink: 0 }}>{formatDateLabel(iso)}</span>
    <span style={{ flex: 1, height: 1, background: tokens.color.rule }} aria-hidden="true" />
  </div>
);

const MessageActions = ({
  visible,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  // Always mounted so hover transitions don't remount and shift layout.
  // `opacity` + `pointer-events` gate visibility and interaction; the
  // transition smooths the appearance so the flicker pattern from
  // conditional render is gone entirely.
  if (!canEdit && !canDelete) return null;
  return (
    <span
      style={{
        marginLeft: 8,
        fontFamily: tokens.type.mono,
        fontSize: 11,
        display: 'inline-flex',
        gap: 8,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 80ms ease',
      }}
    >
      {canEdit ? (
        <Button variant="link" size="sm" onClick={onEdit} style={{ fontSize: 11 }}>
          edit
        </Button>
      ) : null}
      {canDelete ? (
        <Button variant="linkDanger" size="sm" onClick={onDelete} style={{ fontSize: 11 }}>
          delete
        </Button>
      ) : null}
    </span>
  );
};

const InlineEditor = ({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initial);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      // Move cursor to the end of existing text.
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      const trimmed = value.trim();
      if (trimmed && trimmed !== initial) onSave(trimmed);
      else onCancel();
    }
  };

  return (
    <Col gap={4} style={{ marginTop: 2, marginBottom: 2, flex: 1, minWidth: 0 }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        rows={Math.min(6, Math.max(1, value.split('\n').length))}
        style={{
          width: '100%',
          resize: 'vertical',
          fontFamily: tokens.type.mono,
          fontSize: 13,
          padding: '6px 8px',
          background: '#fff',
          color: tokens.color.ink0,
          border: `1px solid ${tokens.color.rule}`,
          borderTop: `1px solid ${tokens.color.ruleStrong}`,
          borderRadius: tokens.radius.xs,
          outline: 'none',
          boxShadow: 'inset 0 1px 0 rgba(0,0,0,.04)',
        }}
      />
      <Row
        gap={8}
        style={{
          alignItems: 'center',
          fontFamily: tokens.type.mono,
          fontSize: 11,
          color: tokens.color.ink2,
        }}
      >
        <Button
          variant="primary"
          size="sm"
          disabled={!value.trim() || value.trim() === initial}
          onClick={() => onSave(value.trim())}
        >
          Save
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <span>⌘⏎ to save · Esc to cancel</span>
      </Row>
    </Col>
  );
};

const MessageItem = ({
  msg,
  isMine,
  canModerate,
  hovered,
  editing,
  onEnter,
  onLeave,
  onEdit,
  onDelete,
  onCancelEdit,
  onSaveEdit,
}: {
  msg: MessageView;
  isMine: boolean;
  canModerate: boolean;
  hovered: boolean;
  editing: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (next: string) => void;
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
        {editing ? (
          <InlineEditor initial={msg.body} onSave={onSaveEdit} onCancel={onCancelEdit} />
        ) : (
          <>
            {/* Body text gets its own span so its textContent is exactly
                the message body — uncluttered by the always-mounted
                MessageActions text (kept opacity-gated for no-flicker
                hover). Preserves test/screen-reader text-matching. */}
            <span data-testid="message-body">
              {msg.body !== '(attachment)' || msg.attachments.length === 0 ? msg.body : ''}
            </span>
            {msg.editedAt ? (
              <span style={{ color: tokens.color.ink3, fontSize: 11, marginLeft: 6 }}>
                (edited)
              </span>
            ) : null}
            <MessageActions
              visible={hovered}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            {msg.attachments.length > 0 ? (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {msg.attachments.map((a) => (
                  <AttachmentPreview key={a.id} attachment={a} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </MessageRow>
    </div>
  );
};

const DeleteConfirm = ({
  msg,
  onClose,
  onConfirm,
}: {
  msg: MessageView;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <ModalScrim onClose={onClose}>
    <Modal title="Delete message" width={440} onClose={onClose}>
      <Col gap={12}>
        <div style={{ fontSize: 13, color: tokens.color.ink1, lineHeight: 1.55 }}>
          This will remove the message for everyone in this conversation. The author and the
          timestamp stay in the history, but the content is gone. This can't be undone.
        </div>
        <div
          style={{
            background: tokens.color.paper1,
            border: `1px solid ${tokens.color.rule}`,
            padding: '8px 12px',
            borderRadius: tokens.radius.xs,
            fontFamily: tokens.type.mono,
            fontSize: 12,
            color: tokens.color.ink1,
            maxHeight: 120,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {msg.body || '(attachment)'}
        </div>
        <Row gap={8} style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </Row>
      </Col>
    </Modal>
  </ModalScrim>
);

export const MessageList = ({ conversationType, conversationId, myRoomRole }: MessageListProps) => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(
    conversationType,
    conversationId,
  );
  const { data: me } = useMe();
  const ws = useWs();
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MessageView | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);

  const startEdit = (id: string) => {
    setEditingId(id);
    setHoveredId(null);
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id: string, body: string) => {
    try {
      await ws?.request('message.edit', { id, body });
      setEditingId(null);
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Edit failed',
        body: err instanceof Error ? err.message : 'could not edit message',
      });
    }
  };
  const requestDelete = (msg: MessageView) => setConfirmDelete(msg);
  const performDelete = async () => {
    const target = confirmDelete;
    if (!target) return;
    setConfirmDelete(null);
    try {
      await ws?.request('message.delete', { id: target.id });
    } catch (err) {
      toast.push({
        tone: 'error',
        title: 'Delete failed',
        body: err instanceof Error ? err.message : 'could not delete message',
      });
    }
  };

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

  // isAtBottom toggles the jump-to-latest pill. Wired via React's onScroll
  // (bound on the scroller element below) rather than a useEffect listener —
  // the effect bound against a ref-captured scroller wasn't firing cleanly
  // under HMR / remount churn.
  const handleScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    setIsAtBottom(distanceFromBottom < 48);
  };

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
      style={{
        flex: 1,
        position: 'relative',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
    <div
      ref={scrollRef}
      data-testid="message-scroller"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Message history"
      onScroll={handleScroll}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 0',
            fontFamily: tokens.type.mono,
            fontSize: 12,
            color: tokens.color.ink2,
          }}
        >
          {isFetchingNextPage ? (
            <>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  border: `1.5px solid ${tokens.color.ink3}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'agora-spin 700ms linear infinite',
                }}
              />
              <span>loading older messages…</span>
            </>
          ) : (
            <span style={{ color: tokens.color.ink3 }}>↑ scroll up for older messages</span>
          )}
        </div>
      ) : messages.length > 0 ? (
        <div
          role="status"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '18px 16px 10px',
            fontFamily: tokens.type.mono,
            fontSize: 12,
            color: tokens.color.ink2,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              maxWidth: 420,
            }}
          >
            <span
              style={{ flex: 1, height: 1, background: tokens.color.rule }}
              aria-hidden="true"
            />
            <span>start of conversation</span>
            <span
              style={{ flex: 1, height: 1, background: tokens.color.rule }}
              aria-hidden="true"
            />
          </div>
          <div style={{ fontSize: 11, color: tokens.color.ink3 }}>
            first message {formatDateLabel(messages[0]?.createdAt ?? new Date().toISOString())}
          </div>
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
            const prev = vi.index > 0 ? messages[vi.index - 1] : null;
            // Boundary rule: show the date separator on the first visible
            // row AND on every day change. Messages are rendered oldest-
            // first, so the separator goes above a message whose date
            // differs from the one before it.
            const showDay =
              !prev || localDateKey(prev.createdAt) !== localDateKey(msg.createdAt);
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
                {showDay ? <DaySeparator iso={msg.createdAt} /> : null}
                <MessageItem
                  msg={msg}
                  isMine={isMine}
                  canModerate={canModerate}
                  hovered={hoveredId === msg.id}
                  editing={editingId === msg.id}
                  onEnter={() => setHoveredId(msg.id)}
                  onLeave={() => setHoveredId((prev) => (prev === msg.id ? null : prev))}
                  onEdit={() => startEdit(msg.id)}
                  onDelete={() => requestDelete(msg)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={(next) => void saveEdit(msg.id, next)}
                />
              </div>
            );
          })}
        </div>
      )}
      {confirmDelete ? (
        <DeleteConfirm
          msg={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={performDelete}
        />
      ) : null}
    </div>
    {!isAtBottom && messages.length > 0 ? (
      <button
        type="button"
        onClick={() => {
          const scroller = scrollRef.current;
          if (!scroller) return;
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
        }}
        aria-label="Jump to latest message"
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontFamily: tokens.type.mono,
          fontSize: 12,
          background: tokens.color.accent,
          color: '#fff',
          border: `1px solid ${tokens.color.accentInk}`,
          borderRadius: tokens.radius.xs,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,.12) inset',
          cursor: 'pointer',
          zIndex: 5,
        }}
      >
        ↓ jump to latest
      </button>
    ) : null}
    </div>
  );
};
