import type { MouseEventHandler } from 'react';
import type { PresenceState } from '@agora/shared/presence';
import { tokens } from './tokens';
import { Badge } from './Badge';

interface ContactListItemProps {
  name: string;
  status?: PresenceState;
  unread?: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export const ContactListItem = ({
  name,
  status = 'offline',
  unread = 0,
  onClick,
}: ContactListItemProps) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px 3px 16px',
      fontFamily: tokens.type.mono,
      fontSize: 13,
      color: status === 'offline' ? tokens.color.ink2 : tokens.color.ink0,
      cursor: 'pointer',
    }}
  >
    <span
      style={{
        width: 9,
        height: 9,
        display: 'inline-block',
        flexShrink: 0,
        background: status === 'online' ? tokens.color.online : 'transparent',
        border: status !== 'online' ? `1px solid ${status === 'afk' ? tokens.color.afk : tokens.color.offline}` : 'none',
        backgroundImage:
          status === 'afk'
            ? `linear-gradient(135deg, ${tokens.color.afk} 50%, transparent 50%)`
            : undefined,
      }}
    />
    <span style={{ flex: 1 }}>{name}</span>
    {unread > 0 ? <Badge tone="mention">{unread}</Badge> : null}
  </div>
);
