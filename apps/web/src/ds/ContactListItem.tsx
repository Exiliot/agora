import type { MouseEventHandler } from 'react';
import type { PresenceState } from '@agora/shared/presence';
import { tokens } from './tokens';
import { Badge } from './Badge';
import { Presence } from './Presence';

interface ContactListItemProps {
  name: string;
  status?: PresenceState;
  unread?: number;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const ContactListItem = ({
  name,
  status = 'offline',
  unread = 0,
  onClick,
}: ContactListItemProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${name}, ${status}${unread > 0 ? `, ${unread} unread` : ''}`}
    className="ds-row-hoverable"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: '100%',
      padding: '3px 10px 3px 16px',
      fontFamily: tokens.type.mono,
      fontSize: 13,
      color: status === 'offline' ? tokens.color.ink2 : tokens.color.ink0,
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      borderLeft: '2px solid transparent',
      textAlign: 'left',
    }}
  >
    <Presence status={status} size={9} />
    <span style={{ flex: 1 }}>{name}</span>
    {unread > 0 ? <Badge tone="mention">{unread}</Badge> : null}
  </button>
);
