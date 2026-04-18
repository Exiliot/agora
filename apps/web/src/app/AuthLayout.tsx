import { Outlet } from 'react-router-dom';
import { Logo, tokens } from '../ds';

export const AuthLayout = () => (
  <div
    style={{
      minHeight: '100vh',
      background: tokens.color.paper1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 24,
    }}
  >
    <Logo size={28} />
    <Outlet />
  </div>
);
