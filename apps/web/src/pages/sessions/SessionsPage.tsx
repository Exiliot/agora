import { Badge, Button, Col, Meta, PageShell, Table, tokens } from '../../ds';
import { useRevokeSession, useSessions } from '../../features/sessions/useSessions';

const formatDate = (iso: string) => new Date(iso).toLocaleString();

const SessionsPage = () => {
  const { data, isLoading } = useSessions();
  const revoke = useRevokeSession();

  return (
    <PageShell
      title="Active sessions"
      subtitle="Signing out here ends that browser's session only. The current session is highlighted."
    >
      {isLoading ? <Meta>loading…</Meta> : null}
      {data?.length ? (
        <Table
          cols={['', 'Browser / IP', 'Created', 'Last seen', 'Expires', '']}
          rows={data.map((s) => [
            s.isCurrent ? (
              <Badge key="b" tone="accent">
                current
              </Badge>
            ) : (
              <span key="b" />
            ),
            <Col key="ua" gap={2}>
              <span style={{ fontFamily: tokens.type.mono, fontSize: 12 }}>
                {s.userAgent ?? 'unknown'}
              </span>
              <span style={{ fontFamily: tokens.type.mono, fontSize: 11, color: tokens.color.ink2 }}>
                {s.ip ?? '-'}
              </span>
            </Col>,
            <span key="c" style={{ fontFamily: tokens.type.mono, fontSize: 12 }}>
              {formatDate(s.createdAt)}
            </span>,
            <span key="l" style={{ fontFamily: tokens.type.mono, fontSize: 12 }}>
              {formatDate(s.lastSeenAt)}
            </span>,
            <span key="e" style={{ fontFamily: tokens.type.mono, fontSize: 12 }}>
              {formatDate(s.expiresAt)}
            </span>,
            <Button
              key="r"
              size="sm"
              variant={s.isCurrent ? 'danger' : 'default'}
              onClick={() => revoke.mutate(s.id)}
            >
              {s.isCurrent ? 'Sign out here' : 'Revoke'}
            </Button>,
          ])}
          highlightRowAt={data.findIndex((s) => s.isCurrent)}
        />
      ) : null}
    </PageShell>
  );
};

export default SessionsPage;
