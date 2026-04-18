import { Outlet } from 'react-router-dom';
import { AuthHeader, tokens } from '../ds';

export const AuthLayout = () => (
  <div
    style={{
      minHeight: '100vh',
      background: tokens.color.paper1,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <AuthHeader />
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <Outlet />
    </div>
  </div>
);
