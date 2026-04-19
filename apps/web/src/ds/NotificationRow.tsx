import type { CSSProperties } from 'react';
import type { NotificationKind, NotificationView } from '@agora/shared';
import { tokens } from './tokens';

const kindTint = (kind: NotificationKind): string => {
  switch (kind) {
    case 'dm.new_message':
    case 'room.mentioned':
      return tokens.color.accent;
    case 'friend.request':
    case 'friend.accepted':
    case 'room.invitation':
    case 'room.role_changed':
      return tokens.color.online;
    case 'room.ban':
    case 'user.ban':
    case 'room.removed':
    case 'room.deleted':
    case 'session.revoked_elsewhere':
      return tokens.color.danger;
    default:
      return tokens.color.ink2;
  }
};

const titleFor = (n: NotificationView): string => {
  const actor = n.actor?.username ?? '';
  const p = n.payload as Record<string, string | number | null | undefined>;
  switch (n.kind) {
    case 'dm.new_message':
      return `@${p.senderUsername ?? actor}`;
    case 'room.mentioned':
      return `#${(p.roomName as string | undefined) ?? ''} - mention`;
    case 'friend.request':
      return `Friend request from ${p.senderUsername ?? actor}`;
    case 'friend.accepted':
      return `${p.accepterUsername ?? actor} accepted your friend request`;
    case 'room.invitation':
      return `Invited to #${(p.roomName as string | undefined) ?? ''}`;
    case 'room.role_changed':
      return `Role changed in #${p.roomName ?? ''} (${p.change ?? ''})`;
    case 'room.removed':
      return `Removed from #${p.roomName ?? ''}`;
    case 'room.deleted':
      return `Room #${p.roomName ?? ''} deleted`;
    case 'room.ban':
      return `Banned from #${p.roomName ?? ''}`;
    case 'user.ban':
      return `${p.bannerUsername ?? actor} blocked you`;
    case 'room.joined_private':
      return `${p.joinerUsername ?? actor} joined #${p.roomName ?? ''}`;
    case 'session.revoked_elsewhere':
      return `${p.revokedCount ?? 0} other session(s) signed out`;
    default:
      return n.kind;
  }
};

const bodyFor = (n: NotificationView): string => {
  const p = n.payload as Record<string, unknown>;
  if ('snippet' in p && typeof p.snippet === 'string') {
    return n.aggregateCount > 1
      ? `${n.aggregateCount} new messages`
      : p.snippet;
  }
  if (n.kind === 'friend.request' && typeof p.note === 'string' && p.note) {
    return `"${p.note}"`;
  }
  if (n.kind === 'room.ban' && typeof p.reason === 'string' && p.reason) {
    return p.reason;
  }
  return '';
};

const relativeTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

interface NotificationRowProps {
  notification: NotificationView;
  onClick?: () => void;
}

export const NotificationRow = ({ notification, onClick }: NotificationRowProps) => {
  const tint = kindTint(notification.kind);
  const isUnread = notification.readAt === null;
  const style: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 8,
    padding: '8px 10px',
    borderBottom: `1px solid ${tokens.color.rule}`,
    background: isUnread ? tokens.color.paper1 : tokens.color.paper0,
    cursor: onClick ? 'pointer' : 'default',
    textAlign: 'left',
    width: '100%',
    border: 0,
    borderLeft: `2px solid ${tint}`,
  };
  return (
    <button type="button" onClick={onClick} style={style}>
      <span
        style={{
          fontFamily: tokens.type.mono,
          fontSize: 11,
          fontWeight: isUnread ? 600 : 400,
          color: isUnread ? tokens.color.ink0 : tokens.color.ink2,
        }}
      >
        {titleFor(notification)}
      </span>
      <span
        style={{
          fontFamily: tokens.type.sans,
          fontSize: 12,
          color: isUnread ? tokens.color.ink1 : tokens.color.ink2,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {bodyFor(notification)}
      </span>
      <span
        style={{
          fontFamily: tokens.type.mono,
          fontSize: 11,
          color: tokens.color.ink2,
          alignSelf: 'center',
        }}
      >
        {relativeTime(notification.createdAt)}
      </span>
    </button>
  );
};
