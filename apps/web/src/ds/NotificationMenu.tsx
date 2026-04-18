import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { NotificationView } from '@agora/shared';
import { useNotifications } from '../features/notifications/useNotifications';
import { useMarkAllRead } from '../features/notifications/useMarkAllRead';
import { useMarkRead } from '../features/notifications/useMarkRead';
import {
  nativePermissionState,
  requestNativePermission,
} from '../features/notifications/native';
import { tokens } from './tokens';
import { Button } from './Button';
import { NotificationRow } from './NotificationRow';

interface Props {
  anchorRect: DOMRect | null;
  onClose: () => void;
}

const deepLinkFor = (n: NotificationView): string | null => {
  const p = n.payload as Record<string, unknown>;
  switch (n.kind) {
    case 'dm.new_message':
      return typeof p.senderUsername === 'string'
        ? `/dm/${p.senderUsername}`
        : null;
    case 'room.mentioned':
      return typeof p.roomName === 'string' ? `/chat/${p.roomName}` : null;
    case 'room.invitation':
      return '/contacts';
    case 'friend.request':
    case 'friend.accepted':
      return '/contacts';
    case 'room.role_changed':
    case 'room.joined_private':
      return typeof p.roomName === 'string' ? `/chat/${p.roomName}` : null;
    case 'session.revoked_elsewhere':
      return '/sessions';
    default:
      return null;
  }
};

export const NotificationMenu = ({ anchorRect, onClose }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { data, isLoading } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Defer so the click that opened the menu isn't immediately intercepted.
    const t = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
      clearTimeout(t);
    };
  }, [onClose]);

  const notifs = data?.pages.flatMap((p) => p.notifications) ?? [];
  const top = anchorRect ? anchorRect.bottom + 6 : 56;
  const right = anchorRect ? Math.max(12, window.innerWidth - anchorRect.right) : 12;

  const permState = nativePermissionState();

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        right,
        width: 360,
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        background: tokens.color.paper0,
        border: `1px solid ${tokens.color.rule}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        borderRadius: tokens.radius.xs,
        zIndex: 40,
      }}
      role="dialog"
      aria-label="Notifications"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: `1px solid ${tokens.color.rule}`,
          fontFamily: tokens.type.mono,
          fontSize: 12,
          color: tokens.color.ink1,
        }}
      >
        <span>Notifications</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAll.mutate()}
          disabled={notifs.every((n) => n.readAt !== null)}
        >
          Mark all read
        </Button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {isLoading ? (
          <div style={{ padding: 12, color: tokens.color.ink2, fontSize: 12 }}>
            Loading...
          </div>
        ) : notifs.length === 0 ? (
          <div style={{ padding: 12, color: tokens.color.ink2, fontSize: 12 }}>
            Nothing here yet.
          </div>
        ) : (
          notifs.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onClick={() => {
                if (n.readAt === null) markOne.mutate(n.id);
                const link = deepLinkFor(n);
                if (link) navigate(link);
                onClose();
              }}
            />
          ))
        )}
      </div>
      {permState === 'default' ? (
        <div
          style={{
            padding: '6px 10px',
            borderTop: `1px solid ${tokens.color.rule}`,
            fontFamily: tokens.type.mono,
            fontSize: 11,
          }}
        >
          <button
            type="button"
            onClick={() => void requestNativePermission()}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.color.accent,
              textDecoration: 'underline',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            Turn on desktop notifications
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
};
