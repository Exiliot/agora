import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Col,
  ConfirmModal,
  EmptyState,
  Input,
  Meta,
  PageShell,
  Row,
  SectionHeader,
  Table,
  tokens,
  useToast,
} from '../../ds';
import { ApiError } from '../../lib/apiClient';
import { useChangePassword } from '../../features/auth/useChangePassword';
import { useDeleteAccount } from '../../features/auth/useDeleteAccount';
import { useRevokeSession, useSessions } from '../../features/sessions/useSessions';

// Short absolute form ("17 Apr, 09:12") keeps each When line to a single row
// of mono text inside the 720-max PageShell column.
const shortDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Rough relative time – keeps the "last seen / expires" lines scannable. */
const relative = (iso: string): string => {
  const delta = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(delta);
  const direction = delta < 0 ? 'ago' : 'in';
  const value = (n: number, unit: string) =>
    direction === 'ago' ? `${n}${unit} ago` : `in ${n}${unit}`;
  if (abs < MINUTE) return direction === 'ago' ? 'just now' : 'any moment';
  if (abs < HOUR) return value(Math.round(abs / MINUTE), 'm');
  if (abs < DAY) return value(Math.round(abs / HOUR), 'h');
  return value(Math.round(abs / DAY), 'd');
};

interface SessionRow {
  id: string;
  isCurrent: boolean;
  userAgent: string | null;
}

const ChangePasswordForm = () => {
  const toast = useToast();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('new passwords do not match');
      return;
    }
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
          toast.push({
            tone: 'success',
            title: 'Password changed',
            body: 'Other browsers signed in on your account have been signed out.',
          });
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.body?.error === 'invalid_credentials') {
              setError('current password is incorrect');
              return;
            }
            if (err.body?.error === 'invalid_input') {
              setError('new password must be at least 8 characters');
              return;
            }
          }
          setError(err instanceof Error ? err.message : 'could not change password');
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit}>
      <Col gap={10} style={{ maxWidth: 320 }}>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          reveal
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          reveal
          minLength={8}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          reveal
          minLength={8}
          {...(error ? { errorMessage: error } : {})}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <Row gap={8}>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            pending={change.isPending}
            disabled={!current || !next || !confirm}
          >
            Change password
          </Button>
        </Row>
      </Col>
    </form>
  );
};

const SessionsPage = () => {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();
  const navigate = useNavigate();
  const toast = useToast();
  const deleteAccount = useDeleteAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<SessionRow | null>(null);

  const handleDelete = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        navigate('/sign-in', {
          replace: true,
          state: { flash: 'Your account has been deleted.' },
        });
      },
      onError: (err) => {
        setConfirmOpen(false);
        toast.push({
          tone: 'error',
          title: 'Delete failed',
          body: err instanceof Error ? err.message : 'could not delete account',
        });
      },
    });
  };

  return (
    <PageShell
      title="Active sessions"
      subtitle="Signing out here ends that browser's session only. The current session is highlighted."
    >
      {isLoading ? <Meta>loading…</Meta> : null}
      {!isLoading && data && data.length === 0 ? (
        <EmptyState caption="no active sessions" />
      ) : null}
      {data?.length ? (
        <Table
          caption="Active sessions on your account"
          cols={['Session', 'When', '']}
          rows={data.map((s) => [
            <Col key="s" gap={3}>
              <Row gap={6} style={{ alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: tokens.type.mono,
                    fontSize: 12,
                    color: tokens.color.ink0,
                  }}
                >
                  {s.userAgent ?? 'unknown'}
                </span>
                {s.isCurrent ? <Badge tone="accent">current</Badge> : null}
              </Row>
              <span
                style={{
                  fontFamily: tokens.type.mono,
                  fontSize: 11,
                  color: tokens.color.ink2,
                }}
              >
                {s.ip ?? '-'}
              </span>
            </Col>,
            <Col key="w" gap={2}>
              <Meta>created · {shortDate(s.createdAt)}</Meta>
              <Meta>last seen · {relative(s.lastSeenAt)}</Meta>
              <Meta>expires · {relative(s.expiresAt)}</Meta>
            </Col>,
            <Button
              key="r"
              size="sm"
              variant={s.isCurrent ? 'danger' : 'default'}
              onClick={() =>
                setConfirmRevoke({
                  id: s.id,
                  isCurrent: s.isCurrent,
                  userAgent: s.userAgent ?? null,
                })
              }
            >
              {s.isCurrent ? 'Sign out here' : 'Revoke'}
            </Button>,
          ])}
          highlightRowAt={data.findIndex((s) => s.isCurrent)}
        />
      ) : null}

      <section style={{ marginTop: 32 }}>
        <SectionHeader>Change password</SectionHeader>
        <div style={{ marginTop: 10 }}>
          <ChangePasswordForm />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <SectionHeader>Danger zone</SectionHeader>
        <div
          style={{
            padding: '12px 14px',
            background: tokens.color.paper1,
            borderLeft: `2px solid ${tokens.color.danger}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: tokens.color.ink1,
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            Deleting your account is permanent. Rooms you own are removed and your friendships end.
            Your messages in direct conversations are kept readable for the other side with your
            name replaced.
          </div>
          <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
            Delete my account
          </Button>
        </div>
        {confirmOpen ? (
          <ConfirmModal
            title="Delete account"
            confirmLabel="Delete account"
            tone="danger"
            pending={deleteAccount.isPending}
            onConfirm={handleDelete}
            onCancel={() => setConfirmOpen(false)}
          >
            This will permanently delete your agora account, every room you own, and every
            friendship. Direct message history you've authored is kept for the other side but your
            name is replaced with "(deleted user)". This action cannot be undone.
          </ConfirmModal>
        ) : null}
      </section>
      {confirmRevoke ? (
        <ConfirmModal
          title={confirmRevoke.isCurrent ? 'Sign out here' : 'Revoke session'}
          confirmLabel={confirmRevoke.isCurrent ? 'Sign out' : 'Revoke'}
          pending={revoke.isPending}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() =>
            revoke.mutate(confirmRevoke.id, {
              onSettled: () => setConfirmRevoke(null),
            })
          }
        >
          {confirmRevoke.isCurrent
            ? 'Sign out of this browser session? You will need to sign in again to return.'
            : (
                <>
                  End the session on{' '}
                  <span style={{ fontFamily: tokens.type.mono }}>
                    {confirmRevoke.userAgent ?? 'that browser'}
                  </span>
                  ? It will be signed out immediately.
                </>
              )}
        </ConfirmModal>
      ) : null}
    </PageShell>
  );
};

export default SessionsPage;
