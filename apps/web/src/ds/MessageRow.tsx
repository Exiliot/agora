import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface ReplyRef {
  user: string;
  color?: string;
  text: string;
}

interface MessageRowProps {
  time: string;
  /**
   * ISO timestamp for the message. When provided, the `[HH:MM]` cell is
   * wrapped in `<time dateTime={iso} title={locale}>` so screen-reader
   * users hear the full absolute time rather than "bracket 14 bracket 32
   * bracket" character-by-character.
   */
  timeIso?: string;
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
  timeIso,
  user,
  color,
  self = false,
  mention = false,
  system = false,
  deleted = false,
  reply,
  children,
}: MessageRowProps) => {
  const absolute = timeIso ? new Date(timeIso).toLocaleString() : undefined;
  const timeCell = timeIso ? (
    <time
      dateTime={timeIso}
      title={absolute}
      style={{ color: tokens.color.ink3, flexShrink: 0, userSelect: 'none' }}
    >
      [{time}]
    </time>
  ) : (
    <span style={{ color: tokens.color.ink3, flexShrink: 0, userSelect: 'none' }}>[{time}]</span>
  );

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
        {timeIso ? (
          <time dateTime={timeIso} title={absolute} style={{ color: tokens.color.ink3 }}>
            [{time}]
          </time>
        ) : (
          <span style={{ color: tokens.color.ink3 }}>[{time}]</span>
        )}{' '}
        {children}
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
      {timeCell}
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
          {deleted ? <em>message deleted</em> : children}
        </span>
      </div>
    </div>
  );
};
