import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Col, Input, Modal, Row, Toast, tokens } from '../../ds';
import { useRegister } from '../../features/auth/useRegister';
import { ApiError } from '../../lib/apiClient';

const RegisterPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const register = useRegister();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('passwords do not match');
      return;
    }
    register.mutate(
      { email, username, password },
      {
        onSuccess: () => navigate('/chat', { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError) {
            const body = err.body;
            if (body?.error === 'email_taken') setError('that email is already registered');
            else if (body?.error === 'username_taken') setError('that username is taken');
            else if (body?.message) setError(body.message);
            else setError(`error ${err.status}`);
          } else if (err instanceof Error) {
            setError(err.message);
          }
        },
      },
    );
  };

  return (
    <Modal title="Register" width={360} titleLevel={1}>
      <form onSubmit={handleSubmit}>
        <Col gap={12}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            hint="lowercase letters, digits, . _ - · 3-32 chars · starts with a letter"
          />
          <Input
            label="Password"
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
              to="/sign-in"
              style={{ fontSize: 12, color: tokens.color.accent, textDecoration: 'underline' }}
            >
              Already have an account?
            </Link>
            <Button type="submit" variant="primary" disabled={register.isPending}>
              {register.isPending ? '…' : 'Create account'}
            </Button>
          </Row>
        </Col>
      </form>
    </Modal>
  );
};

export default RegisterPage;
