import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Col, Input, Modal, Row, Toast, tokens } from '../../ds';
import { useRequestPasswordReset } from '../../features/auth/useRequestPasswordReset';
import { useConsumePasswordReset } from '../../features/auth/useConsumePasswordReset';
import { ApiError } from '../../lib/apiClient';

const RequestForm = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const request = useRequestPasswordReset();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    request.mutate(
      { email },
      {
        // The server responds 204 for any well-formed email (the anti-
        // enumeration design), so there's no branch on actual match.
        onSuccess: () => setSent(true),
      },
    );
  };

  if (sent) {
    return (
      <Col gap={12}>
        <Toast tone="success">
          If that email matches an account, we've sent a reset link. The link
          expires in 30 minutes.
        </Toast>
        <Toast tone="info">
          <div>
            Demo build: there's no real mailer. Grab the link from the API log:
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: tokens.type.mono,
              fontSize: 11,
              color: tokens.color.ink2,
            }}
          >
            docker compose logs api | grep &quot;AUTH reset link&quot;
          </div>
        </Toast>
        <Row gap={8} style={{ justifyContent: 'flex-end' }}>
          <Link
            to="/sign-in"
            style={{ fontSize: 12, color: tokens.color.accent, textDecoration: 'underline' }}
          >
            Back to sign in
          </Link>
        </Row>
      </Col>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Col gap={12}>
        <div style={{ fontSize: 13, color: tokens.color.ink1, lineHeight: 1.55 }}>
          Enter the email for your account. We'll send a link that lets you set
          a new password.
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Row gap={8} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Link
            to="/sign-in"
            style={{ fontSize: 12, color: tokens.color.accent, textDecoration: 'underline' }}
          >
            Back to sign in
          </Link>
          <Button type="submit" variant="primary" disabled={request.isPending || !email}>
            {request.isPending ? '…' : 'Send reset link'}
          </Button>
        </Row>
      </Col>
    </form>
  );
};

const ConsumeForm = ({ token }: { token: string }) => {
  const navigate = useNavigate();
  const consume = useConsumePasswordReset();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('passwords do not match');
      return;
    }
    consume.mutate(
      { token, password },
      {
        onSuccess: () => {
          navigate('/sign-in', {
            replace: true,
            state: { flash: 'Password updated. Sign in with the new one.' },
          });
        },
        onError: (err) => {
          if (err instanceof ApiError && err.body?.error === 'invalid_token') {
            setError('this reset link is invalid or has expired – request a new one');
          } else if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('could not set the new password');
          }
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <Col gap={12}>
        <div style={{ fontSize: 13, color: tokens.color.ink1, lineHeight: 1.55 }}>
          Set a new password for your account. Minimum 8 characters.
        </div>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          reveal
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          reveal
          minLength={8}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {error ? <Toast tone="error">{error}</Toast> : null}
        <Row gap={8} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Link
            to="/reset"
            style={{ fontSize: 12, color: tokens.color.accent, textDecoration: 'underline' }}
          >
            Request a new link
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={consume.isPending || !password || !confirm}
          >
            {consume.isPending ? '…' : 'Set new password'}
          </Button>
        </Row>
      </Col>
    </form>
  );
};

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <Modal title={token ? 'Set new password' : 'Reset password'} width={380}>
      {token ? <ConsumeForm token={token} /> : <RequestForm />}
    </Modal>
  );
};

export default ResetPasswordPage;
