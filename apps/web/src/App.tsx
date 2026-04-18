import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useMe } from './features/auth/useMe';
import { AuthLayout } from './app/AuthLayout';
import { RootLayout } from './app/RootLayout';
import { ProtectedRoute } from './app/ProtectedRoute';
import { WsProvider } from './app/WsProvider';
import SignInPage from './pages/sign-in/SignInPage';
import RegisterPage from './pages/register/RegisterPage';
import ResetPasswordPage from './pages/reset/ResetPasswordPage';
import ChatView from './pages/chat/ChatView';
import PublicRoomsPage from './pages/public/PublicRoomsPage';
import SessionsPage from './pages/sessions/SessionsPage';
import ContactsPage from './pages/contacts/ContactsPage';
import DmView from './pages/dm/DmView';

const AppRoutes = () => {
  const { data: user } = useMe();
  const signedIn = Boolean(user);

  return (
    <WsProvider enabled={signedIn}>
      <Routes>
        <Route path="/" element={<Navigate to={signedIn ? '/chat' : '/sign-in'} replace />} />
        <Route element={<AuthLayout />}>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <RootLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat" element={<ChatView />} />
          <Route path="/chat/:roomName" element={<ChatView />} />
          <Route path="/dm/:username" element={<DmView />} />
          <Route path="/public" element={<PublicRoomsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/profile" element={<ChatView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </WsProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
