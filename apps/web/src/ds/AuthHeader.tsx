import { NavLink, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { NavTab } from './NavTab';
import { tokens } from './tokens';

/**
 * Simplified top bar for the unauthenticated (auth) routes. Matches the
 * main `RootLayout` header's rhythm (44px tall, paper-1, hairline rule)
 * but only exposes Sign in / Register switching. Keeps the centred
 * auth-card layout below unchanged.
 */
export const AuthHeader = () => {
  const location = useLocation();
  const active = (p: string) => location.pathname.startsWith(p);
  return (
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
      <Logo size={22} />
      <div style={{ flex: 1 }} />
      <NavLink to="/sign-in" style={{ textDecoration: 'none' }}>
        <NavTab active={active('/sign-in')} aria-current={active('/sign-in') ? 'page' : undefined}>
          Sign in
        </NavTab>
      </NavLink>
      <NavLink to="/register" style={{ textDecoration: 'none' }}>
        <NavTab active={active('/register')} aria-current={active('/register') ? 'page' : undefined}>
          Register
        </NavTab>
      </NavLink>
    </header>
  );
};
