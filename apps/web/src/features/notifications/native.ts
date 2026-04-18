import type { NotificationKind, NotificationView } from '@agora/shared';

export const nativePermissionState = (): 'default' | 'granted' | 'denied' => {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
};

export const requestNativePermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
};

// Only high-priority events fire native toasts.
const HIGH_KINDS = new Set<NotificationKind>([
  'dm.new_message',
  'room.mentioned',
  'friend.request',
  'room.invitation',
  'room.ban',
  'user.ban',
]);

// Cross-tab dedup. When multiple tabs are open, exactly one should fire the
// OS toast. Tabs race via a BroadcastChannel claim; earliest claim wins.
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('agora-notif') : null;

interface Claim {
  id: string;
  at: number;
}

const claims = new Map<string, Claim[]>();

channel?.addEventListener('message', (ev: MessageEvent<Claim>) => {
  const c = ev.data;
  if (!c?.id) return;
  const list = claims.get(c.id) ?? [];
  list.push(c);
  claims.set(c.id, list);
});

const titleFor = (n: NotificationView): string => {
  const p = n.payload as Record<string, string | number | null | undefined>;
  switch (n.kind) {
    case 'dm.new_message':
      return `@ ${p.senderUsername ?? 'someone'}`;
    case 'room.mentioned':
      return `# ${p.roomName ?? ''} · mention`;
    case 'friend.request':
      return `Friend request`;
    case 'room.invitation':
      return `Room invitation`;
    case 'room.ban':
      return `Banned from a room`;
    case 'user.ban':
      return `You were blocked`;
    default:
      return 'agora';
  }
};

const bodyFor = (n: NotificationView): string => {
  const p = n.payload as Record<string, unknown>;
  if (typeof p.snippet === 'string') return p.snippet;
  if (n.kind === 'friend.request' && typeof p.senderUsername === 'string') {
    return `${p.senderUsername} wants to connect`;
  }
  if (n.kind === 'room.invitation' && typeof p.inviterUsername === 'string') {
    return `${p.inviterUsername} invited you to # ${p.roomName ?? ''}`;
  }
  if (n.kind === 'user.ban' && typeof p.bannerUsername === 'string') {
    return `${p.bannerUsername} blocked you`;
  }
  return '';
};

export const maybeFireNative = (n: NotificationView): void => {
  if (!HIGH_KINDS.has(n.kind)) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState !== 'hidden') return;

  // Claim this notification id; all tabs that will see this event claim
  // simultaneously. After a short wait, the tab with the earliest claim
  // (or the only claim) actually fires the OS toast.
  const now = Date.now();
  const myClaim: Claim = { id: n.id, at: now };
  channel?.postMessage(myClaim);
  // Also record our own claim locally; the MessageEvent listener only sees
  // messages from OTHER tabs.
  const local = claims.get(n.id) ?? [];
  local.push(myClaim);
  claims.set(n.id, local);

  setTimeout(() => {
    const bucket = claims.get(n.id) ?? [];
    claims.delete(n.id);
    if (bucket.length === 0) return;
    const winner = bucket.reduce((a, b) => (a.at <= b.at ? a : b));
    if (winner.at !== now) return; // another tab beat us
    try {
      const opts: NotificationOptions = {
        body: bodyFor(n),
        tag: `${n.kind}:${n.subjectId ?? n.id}`,
      };
      const toast = new Notification(titleFor(n), opts);
      // Focus our window on click and let the web app handle routing via
      // the normal bell click flow (we just steal the OS toast click to
      // focus the tab).
      toast.onclick = () => {
        window.focus();
        toast.close();
      };
    } catch {
      // Permission revoked mid-session or user-gesture requirement unmet.
      // Silent is fine – the in-app bell still has the entry.
    }
  }, 120);
};
