import { useId, useState, type KeyboardEvent } from 'react';
import type { ConversationType } from '@agora/shared';
import { Button, Row, tokens } from '../../ds';
import { useWs } from '../../app/WsProvider';

interface ComposerProps {
  conversationType: ConversationType;
  conversationId: string;
}

export const Composer = ({ conversationType, conversationId }: ComposerProps) => {
  const ws = useWs();
  const labelId = useId();
  const hintId = useId();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed || !ws) return;
    setSending(true);
    try {
      await ws.request('message.send', {
        conversationType,
        conversationId,
        body: trimmed,
      });
      setBody('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[composer] send failed', err);
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
        padding: 12,
      }}
    >
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
          <span
            id={hintId}
            style={{ fontFamily: tokens.type.mono, fontSize: 11, color: tokens.color.ink3 }}
          >
            ⏎ send · ⇧⏎ newline
          </span>
          <Button variant="primary" size="sm" disabled={!body.trim() || sending} onClick={send}>
            {sending ? '…' : 'Send'}
          </Button>
        </Row>
      </div>
    </div>
  );
};
