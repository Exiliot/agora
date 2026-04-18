import { Badge, Button, Col, Meta, PageShell, Row, Table, tokens } from '../../ds';
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
