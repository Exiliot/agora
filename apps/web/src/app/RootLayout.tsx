import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Bell, Logo, NavTab, NotificationMenu, ToastHost, tokens } from '../ds';
import { useMe } from '../features/auth/useMe';
import { useSignOut } from '../features/auth/useSignOut';
import { useIncomingRequests } from '../features/friends/useFriends';
import { useMyInvitations } from '../features/rooms/useRoomAdmin';
import { useUnreadCount } from '../features/notifications/useUnreadCount';

const NotificationsBadge = () => {
  const { data: requests = [] } = useIncomingRequests();
  const { data: invitations = [] } = useMyInvitations();
  const total = requests.length + invitations.length;
  if (total === 0) return null;
  return (
    <Badge tone="mention" style={{ marginLeft: 6 }}>
      {total}
    </Badge>
  );
};

export const RootLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const signOut = useSignOut();
  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const { data: unread } = useUnreadCount();

  const go = (path: string) => navigate(path);

  const active = (prefix: string) => location.pathname.startsWith(prefix);

  return (
    <ToastHost>
    <div
      style={{
        // Pinned to viewport height, not minHeight: MessageList uses a
        // flex:1 + overflow:auto chain to host its virtualiser. Letting
        // the root grow with content (minHeight: 100vh) breaks that chain
        // — the scroller ends up as tall as its content and the top
        // IntersectionObserver keeps firing page after page of history.
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: tokens.color.paper1,
      }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 44,
          padding: '0 16px',
          background: tokens.color.paper1,
          borderBottom: `1px solid ${tokens.color.rule}`,
          gap: 16,
        }}
      >
        <Logo />
        <div style={{ width: 16 }} />
        <nav
          aria-label="Primary"
          style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}
        >
          <NavLink to="/chat" style={{ textDecoration: 'none' }}>
            <NavTab active={active('/chat')} aria-current={active('/chat') ? 'page' : undefined}>
              Chat
            </NavTab>
          </NavLink>
          <NavLink to="/public" style={{ textDecoration: 'none' }}>
            <NavTab
              active={active('/public')}
              aria-current={active('/public') ? 'page' : undefined}
            >
              Public rooms
            </NavTab>
          </NavLink>
          <NavLink to="/contacts" style={{ textDecoration: 'none' }}>
            <NavTab
              active={active('/contacts')}
              aria-current={active('/contacts') ? 'page' : undefined}
            >
              Contacts
              <NotificationsBadge />
            </NavTab>
          </NavLink>
          <NavLink to="/sessions" style={{ textDecoration: 'none' }}>
            <NavTab
              active={active('/sessions')}
              aria-current={active('/sessions') ? 'page' : undefined}
            >
              Sessions
            </NavTab>
          </NavLink>
        </nav>
        {user ? (
          <>
            <Bell
              ref={bellRef}
              unreadCount={unread?.count ?? 0}
              onClick={() => setNotifOpen((v) => !v)}
            />
            <NavTab as="span" plain>
              {user.username}
            </NavTab>
            <NavTab
              as="button"
              danger
              plain
              onClick={() => signOut.mutate(undefined, { onSuccess: () => go('/sign-in') })}
            >
              Sign out
            </NavTab>
          </>
        ) : null}
      </header>
      {notifOpen ? (
        <NotificationMenu
          anchorRect={bellRef.current?.getBoundingClientRect() ?? null}
          onClose={() => setNotifOpen(false)}
        />
      ) : null}

      <main id="main" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
    </ToastHost>
  );
};
