import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ME_QUERY_KEY, useMe } from './features/auth/useMe';
import { setUnauthorizedHandler } from './lib/apiClient';
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

// H6: on any 401 from the api wrapper, drop the `me` cache to null. The
// next render of ProtectedRoute sees no user and bounces through /sign-in.
// Removes the "stale UI after sibling sign-out" window that the 60s
// staleTime + retry:false combination created.
const useUnauthorizedBinding = (): void => {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.setQueryData(ME_QUERY_KEY, null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);
};

const AppRoutes = () => {
  useUnauthorizedBinding();
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
