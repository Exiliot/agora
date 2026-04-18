import { Button, Col, Meta, Table, tokens } from '../../ds';
import { useRevokeSession, useSessions } from '../../features/sessions/useSessions';

const formatDate = (iso: string) => new Date(iso).toLocaleString();

const SessionsPage = () => {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();

  return (
    <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
      <div style={{ maxWidth: 720 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: tokens.type.sans,
            fontSize: 18,
            fontWeight: 600,
            color: tokens.color.ink0,
          }}
        >
          Active sessions
        </h1>
        <div style={{ fontSize: 12, color: tokens.color.ink2, marginTop: 4 }}>
          Signing out here ends that browser's session only. The current session is highlighted.
        </div>
        <div style={{ height: 16 }} />
        {isLoading ? <Meta>loading…</Meta> : null}
        {data?.length ? (
          <Table
            cols={['Browser / IP', 'Created', 'Last seen', 'Expires', '']}
            rows={data.map((s) => [
              <Col key="ua" gap={2}>
                <span style={{ fontFamily: tokens.type.mono, fontSize: 12 }}>
                  {s.userAgent ?? 'unknown'}
                </span>
                <span style={{ fontSize: 11, color: tokens.color.ink2 }}>{s.ip ?? '-'}</span>
              </Col>,
              <span key="c">{formatDate(s.createdAt)}</span>,
              <span key="l">{formatDate(s.lastSeenAt)}</span>,
              <span key="e">{formatDate(s.expiresAt)}</span>,
              <Button
                key="r"
                size="sm"
                variant={s.isCurrent ? 'danger' : 'default'}
                onClick={() => revoke.mutate(s.id)}
              >
                {s.isCurrent ? 'Sign out here' : 'Revoke'}
              </Button>,
            ])}
          />
        ) : null}
      </div>
    </div>
  );
};

export default SessionsPage;
