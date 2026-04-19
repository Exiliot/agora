import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Col,
  Input,
  ListRow,
  Meta,
  PageShell,
  Row,
  RoomName,
  SectionHeader,
  TabBar,
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
import {
  useAcceptInvitation,
  useMyInvitations,
  useRejectInvitation,
} from '../../features/rooms/useRoomAdmin';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} style={{ marginTop: 24 }}>
      <SectionHeader id={headingId}>{title}</SectionHeader>
      {children}
    </section>
  );
};

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
            <ListRow
              key={user.id}
              title={user.username}
              actions={
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
              }
            />
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
        <ListRow
          key={req.id}
          title={req.sender.username}
          meta={req.note ? `“${req.note}”` : undefined}
          actions={
            <>
              <Button size="sm" variant="primary" onClick={() => accept.mutate(req.id)}>
                Accept
              </Button>
              <Button size="sm" onClick={() => reject.mutate(req.id)}>
                Reject
              </Button>
            </>
          }
        />
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
        <ListRow
          key={req.id}
          title={req.recipient.username}
          actions={
            <Button size="sm" onClick={() => cancel.mutate(req.id)}>
              Cancel
            </Button>
          }
        />
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

  if (data.length === 0) return <Meta>no friends yet – search for a user above</Meta>;
  return (
    <Table
      caption="Friends"
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
      caption="Users you have blocked"
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

const Invitations = () => {
  const { data = [] } = useMyInvitations();
  const accept = useAcceptInvitation();
  const reject = useRejectInvitation();
  const navigate = useNavigate();
  if (data.length === 0) return <Meta>no pending invitations</Meta>;
  return (
    <Col gap={6}>
      {data.map((inv) => (
        <ListRow
          key={inv.id}
          title={<RoomName name={inv.room.name} visibility={inv.room.visibility} size="sm" />}
          meta={`invited by ${inv.inviter?.username ?? '(deleted)'}`}
          actions={
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  accept.mutate(inv.id, {
                    onSuccess: () => navigate(`/chat/${inv.room.name}`),
                  })
                }
              >
                Accept
              </Button>
              <Button size="sm" onClick={() => reject.mutate(inv.id)}>
                Reject
              </Button>
            </>
          }
        />
      ))}
    </Col>
  );
};

const ContactsPage = () => {
  const { data: incoming = [] } = useIncomingRequests();
  const { data: invitations = [] } = useMyInvitations();
  const [active, setActive] = useState(0);

  const requestsLabel =
    incoming.length > 0 ? `Requests (${incoming.length})` : 'Requests';
  const invitationsLabel =
    invitations.length > 0 ? `Invitations (${invitations.length})` : 'Invitations';

  return (
    <PageShell
      title="Contacts"
      subtitle="Add people by username, accept incoming requests, manage bans. Personal messages are only allowed between friends."
    >
      <Section title="Add a friend">
        <UserSearch />
      </Section>

      <div style={{ marginTop: 20 }}>
        <TabBar
          items={['Friends', requestsLabel, invitationsLabel, 'Blocked']}
          active={active}
          onSelect={setActive}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {active === 0 ? <FriendList /> : null}
        {active === 1 ? (
          <Col gap={16}>
            <Section title="Incoming requests">
              <IncomingRequests />
            </Section>
            <Section title="Outgoing requests">
              <OutgoingRequests />
            </Section>
          </Col>
        ) : null}
        {active === 2 ? <Invitations /> : null}
        {active === 3 ? <MyBans /> : null}
      </div>
    </PageShell>
  );
};

export default ContactsPage;
