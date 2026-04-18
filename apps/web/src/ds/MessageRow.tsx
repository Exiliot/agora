import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface ReplyRef {
  user: string;
  color?: string;
  text: string;
}

interface MessageRowProps {
  time: string;
  user?: string;
  color?: string;
  self?: boolean;
  mention?: boolean;
  system?: boolean;
  deleted?: boolean;
  reply?: ReplyRef;
  children?: ReactNode;
}

/**
 * The anchor component of agora. `[HH:MM] nick: message`.
 * No bubbles. Reply is a quote-indented stripe. Mention is a left-ruled wash.
 */
export const MessageRow = ({
  time,
  user,
  color,
  self = false,
  mention = false,
  system = false,
  deleted = false,
  reply,
  children,
}: MessageRowProps) => {
  if (system) {
    return (
      <div
        style={{
          fontFamily: tokens.type.mono,
          fontSize: 12,
          color: tokens.color.ink2,
          padding: '2px 16px',
          fontStyle: 'italic',
        }}
      >
        <span style={{ color: tokens.color.ink3 }}>[{time}]</span> {children}
      </div>
    );
  }

  const userColor = color ?? '#7a6a5c';

  // Left-rail priority: mention first (amber), self second (accent-soft), none.
  // Using a single 2px rail keeps the row width steady across states.
  const railColor = mention
    ? tokens.color.mentionFg
    : self
      ? tokens.color.accentSoft
      : 'transparent';

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '2px 16px',
        fontFamily: tokens.type.mono,
        fontSize: 13,
        lineHeight: 1.5,
        background: mention
          ? `linear-gradient(90deg, ${tokens.color.mentionWash}, transparent 60%)`
          : undefined,
        borderLeft: `2px solid ${railColor}`,
        opacity: deleted ? 0.4 : 1,
      }}
    >
      <span style={{ color: tokens.color.ink3, flexShrink: 0, userSelect: 'none' }}>[{time}]</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        {reply ? (
          <div
            style={{
              fontSize: 11,
              color: tokens.color.ink2,
              borderLeft: `2px solid ${tokens.color.rule}`,
              paddingLeft: 6,
              marginBottom: 2,
            }}
          >
            <span style={{ color: reply.color ?? '#7a6a5c', fontWeight: 600 }}>
              ↳ {reply.user}
            </span>
            : {reply.text}
          </div>
        ) : null}
        <span
          style={{
            color: userColor,
            fontWeight: 600,
          }}
        >
          {user}
          {self ? ' (you)' : ''}
        </span>
        <span style={{ color: tokens.color.ink2 }}>: </span>
        <span style={{ color: deleted ? tokens.color.ink3 : tokens.color.ink0 }}>
          {deleted ? <i>message deleted</i> : children}
        </span>
      </div>
    </div>
  );
};
