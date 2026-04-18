import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Col,
  Input,
  Meta,
  Row,
  Table,
  tokens,
} from '../../ds';
import {
  useAcceptFriendRequest,
  useBanUser,
  useCancelFriendRequest,
  useFriends,
  useIncomingRequests,
  useMyBans,
  useOutgoingRequests,
  useRejectFriendRequest,
  useSearchUsers,
  useSendFriendRequest,
  useUnbanUser,
  useUnfriend,
} from '../../features/friends/useFriends';
import { useOpenDm } from '../../features/dm/useOpenDm';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginTop: 28 }}>
    <div style={{ fontFamily: tokens.type.serif, fontSize: 16, marginBottom: 6 }}>{title}</div>
    {children}
  </section>
);

const UserSearch = () => {
  const [q, setQ] = useState('');
  const { data = [] } = useSearchUsers(q);
  const send = useSendFriendRequest();
  const [justSent, setJustSent] = useState<Set<string>>(new Set());

  return (
    <Col gap={10}>
      <Input
        placeholder="Search users by username…"
        value={q}
        onChange={(event) => setQ(event.target.value.toLowerCase())}
      />
      {data.length > 0 ? (
        <Col gap={6}>
          {data.map((user) => (
            <Row
              key={user.id}
              style={{
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: '#fff',
                border: `1px solid ${tokens.color.rule}`,
                borderRadius: tokens.radius.xs,
              }}
            >
              <span style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>{user.username}</span>
              <Button
                size="sm"
                disabled={justSent.has(user.id) || send.isPending}
                onClick={() =>
                  send.mutate(
                    { targetUsername: user.username },
                    { onSuccess: () => setJustSent((prev) => new Set(prev).add(user.id)) },
                  )
                }
              >
                {justSent.has(user.id) ? 'Sent' : 'Add friend'}
              </Button>
            </Row>
          ))}
        </Col>
      ) : q ? (
        <Meta>no matches</Meta>
      ) : null}
    </Col>
  );
};

const IncomingRequests = () => {
  const { data = [] } = useIncomingRequests();
  const accept = useAcceptFriendRequest();
  const reject = useRejectFriendRequest();
  if (data.length === 0) return <Meta>no pending requests</Meta>;
  return (
    <Col gap={6}>
      {data.map((req) => (
        <Row
          key={req.id}
          style={{
            justifyContent: 'space-between',
            padding: '6px 10px',
            background: '#fff',
            border: `1px solid ${tokens.color.rule}`,
            borderRadius: tokens.radius.xs,
          }}
        >
          <Col gap={2}>
            <span style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
              {req.sender.username}
            </span>
            {req.note ? (
              <span style={{ fontSize: 11, color: tokens.color.ink2 }}>“{req.note}”</span>
            ) : null}
          </Col>
          <Row gap={6}>
            <Button size="sm" variant="primary" onClick={() => accept.mutate(req.id)}>
              Accept
            </Button>
            <Button size="sm" onClick={() => reject.mutate(req.id)}>
              Reject
            </Button>
          </Row>
        </Row>
      ))}
    </Col>
  );
};

const OutgoingRequests = () => {
  const { data = [] } = useOutgoingRequests();
  const cancel = useCancelFriendRequest();
  if (data.length === 0) return <Meta>no pending outgoing requests</Meta>;
  return (
    <Col gap={6}>
      {data.map((req) => (
        <Row
          key={req.id}
          style={{
            justifyContent: 'space-between',
            padding: '6px 10px',
            background: '#fff',
            border: `1px solid ${tokens.color.rule}`,
            borderRadius: tokens.radius.xs,
          }}
        >
          <span style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
            {req.recipient.username}
          </span>
          <Button size="sm" variant="danger" onClick={() => cancel.mutate(req.id)}>
            Cancel
          </Button>
        </Row>
      ))}
    </Col>
  );
};

const FriendList = () => {
  const { data = [] } = useFriends();
  const unfriend = useUnfriend();
  const ban = useBanUser();
  const openDm = useOpenDm();
  const navigate = useNavigate();

  if (data.length === 0) return <Meta>no friends yet — search for a user above</Meta>;
  return (
    <Table
      cols={['Friend', 'Since', '']}
      rows={data.map((f) => [
        <span key="u" style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
          {f.user.username}
        </span>,
        <span key="s" style={{ fontSize: 11, color: tokens.color.ink2 }}>
          {new Date(f.establishedAt).toLocaleDateString()}
        </span>,
        <Row key="a" gap={6} style={{ justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              openDm.mutate(f.user.id, {
                onSuccess: () => navigate(`/dm/${f.user.username}`),
              })
            }
          >
            Message
          </Button>
          <Button size="sm" onClick={() => unfriend.mutate(f.user.id)}>
            Unfriend
          </Button>
          <Button size="sm" variant="danger" onClick={() => ban.mutate(f.user.id)}>
            Ban
          </Button>
        </Row>,
      ])}
    />
  );
};

const MyBans = () => {
  const { data = [] } = useMyBans();
  const unban = useUnbanUser();
  if (data.length === 0) return <Meta>no user bans in place</Meta>;
  return (
    <Table
      cols={['User', 'Since', '']}
      rows={data.map((b) => [
        <span key="u" style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
          {b.target.username}
        </span>,
        <span key="s" style={{ fontSize: 11, color: tokens.color.ink2 }}>
          {new Date(b.createdAt).toLocaleDateString()}
        </span>,
        <Row key="a" gap={6} style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" onClick={() => unban.mutate(b.target.id)}>
            Unban
          </Button>
        </Row>,
      ])}
    />
  );
};

const ContactsPage = () => (
  <div style={{ flex: 1, padding: '24px 32px', overflow: 'auto' }}>
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontFamily: tokens.type.serif, fontSize: 22 }}>Contacts</div>
      <div style={{ fontSize: 12, color: tokens.color.ink2, marginTop: 4 }}>
        Add people by username, accept incoming requests, manage bans. Personal messages are only
        allowed between friends.
      </div>

      <Section title="Add a friend">
        <UserSearch />
      </Section>

      <Section title="Incoming requests">
        <IncomingRequests />
      </Section>

      <Section title="Outgoing requests">
        <OutgoingRequests />
      </Section>

      <Section title="Friends">
        <FriendList />
      </Section>

      <Section title="Blocked users">
        <MyBans />
      </Section>
    </div>
  </div>
);

export default ContactsPage;
