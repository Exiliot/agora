import type { MouseEventHandler } from 'react';
import { tokens } from './tokens';
import { Badge } from './Badge';

interface RoomListItemProps {
  name: string;
  unread?: number;
  active?: boolean;
  isPrivate?: boolean;
  muted?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const RoomListItem = ({
  name,
  unread = 0,
  active = false,
  isPrivate = false,
  muted = false,
  onClick,
}: RoomListItemProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'true' : undefined}
    aria-label={`${isPrivate ? 'Private room' : 'Room'} ${name}${unread > 0 ? `, ${unread} unread` : ''}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      width: '100%',
      padding: '3px 10px 3px 16px',
      background: active ? tokens.color.accentSoft : 'transparent',
      borderLeft: active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
      borderRight: 'none',
      borderTop: 'none',
      borderBottom: 'none',
      fontFamily: tokens.type.mono,
      fontSize: 13,
      color: active ? tokens.color.accentInk : muted ? tokens.color.ink2 : tokens.color.ink0,
      cursor: 'pointer',
      textAlign: 'left',
    }}
  >
    <span
      aria-hidden="true"
      style={{ color: tokens.color.ink2, width: 12, textAlign: 'center', fontSize: 11 }}
    >
      {isPrivate ? '•' : '#'}
    </span>
    <span
      style={{
        flex: 1,
        textDecoration: muted ? 'line-through' : 'none',
        opacity: muted ? 0.6 : 1,
      }}
    >
      {name}
    </span>
    {unread > 0 ? <Badge tone="mention">{unread}</Badge> : null}
  </button>
);
