import { Outlet } from 'react-router-dom';
import { Logo } from '../ds';

export const AuthLayout = () => (
  <div
    style={{
      minHeight: '100vh',
      background: 'var(--paper-1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 24,
    }}
  >
    <Logo size={36} />
    <Outlet />
  </div>
);
