import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Check, Col, Input, Modal, Row, Toast, tokens } from '../../ds';
import { useSignIn } from '../../features/auth/useSignIn';
import { ApiError } from '../../lib/apiClient';

interface SignInFlashState {
  flash?: string;
}

const SignInPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextUrl = searchParams.get('next') ?? '/chat';
  const flash = (location.state as SignInFlashState | null)?.flash ?? null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const signIn = useSignIn();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    signIn.mutate(
      { email, password },
      {
        onSuccess: () => navigate(nextUrl, { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 401) {
            setError('invalid credentials');
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('sign-in failed');
          }
        },
      },
    );
  };

  const hasError = Boolean(error);

  return (
    <Modal title="Sign in" width={360} titleLevel={1}>
      <form onSubmit={handleSubmit}>
        <Col gap={12}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            error={hasError}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            reveal
            error={hasError}
            {...(error ? { errorMessage: error } : {})}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Check label="Keep me signed in" defaultChecked />
          {flash && !error ? <Toast tone="success">{flash}</Toast> : null}
          <Row gap={8} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Link
              to="/reset"
              style={{ fontSize: 12, color: tokens.color.accent, textDecoration: 'underline' }}
            >
              Forgot password?
            </Link>
            <Button type="submit" variant="primary" disabled={signIn.isPending}>
              {signIn.isPending ? '…' : 'Sign in'}
            </Button>
          </Row>
          <div style={{ fontSize: 12, color: tokens.color.ink2 }}>
            No account yet?{' '}
            <Link
              to="/register"
              style={{ color: tokens.color.accent, textDecoration: 'underline' }}
            >
              Register
            </Link>
          </div>
        </Col>
      </form>
    </Modal>
  );
};

export default SignInPage;
