import { useEffect, useRef } from 'react';
import type { ConversationType, MessageView } from '@agora/shared';
import { MessageRow, colorForName, tokens } from '../../ds';
import { useMessages } from '../../features/messages/useMessages';

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
            {msg.body}
            {msg.editedAt ? (
              <span style={{ color: tokens.color.ink3, fontSize: 11, marginLeft: 6 }}>(edited)</span>
            ) : null}
          </MessageRow>
        ))
      )}
    </div>
  );
};
