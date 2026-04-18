import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo, NavTab, tokens } from '../ds';
import { useMe } from '../features/auth/useMe';
import { useSignOut } from '../features/auth/useSignOut';

export const RootLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const signOut = useSignOut();

  const go = (path: string) => navigate(path);

  const active = (prefix: string) => location.pathname.startsWith(prefix);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: tokens.color.paper1,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 56,
          padding: '0 16px',
          background: tokens.color.paper1,
          borderBottom: `1px solid ${tokens.color.rule}`,
          gap: 16,
        }}
      >
        <Logo />
        <div style={{ width: 16 }} />
        <NavLink to="/chat" style={{ textDecoration: 'none' }}>
          <NavTab active={active('/chat')}>Chat</NavTab>
        </NavLink>
        <NavLink to="/public" style={{ textDecoration: 'none' }}>
          <NavTab active={active('/public')}>Public rooms</NavTab>
        </NavLink>
        <NavLink to="/contacts" style={{ textDecoration: 'none' }}>
          <NavTab active={active('/contacts')}>Contacts</NavTab>
        </NavLink>
        <NavLink to="/sessions" style={{ textDecoration: 'none' }}>
          <NavTab active={active('/sessions')}>Sessions</NavTab>
        </NavLink>
        <div style={{ flex: 1 }} />
        {user ? (
          <>
            <NavTab onClick={() => go('/profile')} style={{ cursor: 'pointer' }}>
              {user.username} ▾
            </NavTab>
            <NavTab
              danger
              style={{ cursor: 'pointer' }}
              onClick={() => signOut.mutate(undefined, { onSuccess: () => go('/sign-in') })}
            >
              Sign out
            </NavTab>
          </>
        ) : null}
      </header>

      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
};
