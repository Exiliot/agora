import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMyRooms } from '../../features/rooms/useRooms';
import { useRoom } from '../../features/rooms/useRoom';
import { Badge, Button, ContactListItem, Meta, Row, tokens } from '../../ds';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { Sidebar } from './Sidebar';
import { ManageRoomModal } from './ManageRoomModal';
import { usePresenceOf } from '../../app/WsProvider';

const MemberRow = ({ userId, username }: { userId: string; username: string }) => {
  const state = usePresenceOf(userId);
  return <ContactListItem name={username} status={state} />;
};

const RoomHeader = ({ roomName, description, memberCount, visibility }: {
  roomName: string;
  description: string | null;
  memberCount: number;
  visibility: string;
}) => (
  <div
    style={{
      padding: '12px 16px',
      borderBottom: `1px solid ${tokens.color.rule}`,
      background: tokens.color.paper1,
    }}
  >
    <div style={{ fontFamily: tokens.type.mono, fontSize: 14, fontWeight: 600 }}># {roomName}</div>
    {description ? (
      <div style={{ fontFamily: tokens.type.sans, fontSize: 12, color: tokens.color.ink2 }}>
        {description}
      </div>
    ) : null}
    <Row gap={12} style={{ marginTop: 6, alignItems: 'center' }}>
      <Badge tone={visibility === 'private' ? 'private' : 'neutral'}>{visibility}</Badge>
      <span style={{ fontFamily: tokens.type.mono, fontSize: 12, color: tokens.color.ink2 }}>
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </span>
    </Row>
  </div>
);

const ChatView = () => {
  const { roomName } = useParams<{ roomName: string }>();
  const { data: myRooms } = useMyRooms();
  const room = useMemo(
    () => myRooms?.find((r) => r.name === roomName) ?? null,
    [myRooms, roomName],
  );
  const { data: detail } = useRoom(room?.id ?? null);
  const [manageOpen, setManageOpen] = useState(false);

  if (!roomName) {
    return (
      <div style={{ display: 'flex', flex: 1, background: tokens.color.paper1 }}>
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.color.ink2,
            fontFamily: tokens.type.mono,
            fontSize: 13,
          }}
        >
          pick a room from the sidebar or{' '}
          <Link
            to="/public"
            style={{
              marginLeft: 4,
              color: tokens.color.accent,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            browse public rooms
          </Link>
          .
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div style={{ display: 'flex', flex: 1, background: tokens.color.paper1 }}>
        <Sidebar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.color.ink2,
            fontFamily: tokens.type.mono,
            fontSize: 13,
          }}
        >
          you're not a member of #{roomName}.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <RoomHeader
          roomName={room.name}
          description={room.description}
          memberCount={room.memberCount}
          visibility={room.visibility}
        />
        <MessageList
          conversationType="room"
          conversationId={room.id}
          myRoomRole={detail?.myRole ?? null}
        />
        <Composer conversationType="room" conversationId={room.id} />
      </div>
      <aside
        style={{
          width: 240,
          minWidth: 240,
          flexShrink: 0,
          background: tokens.color.paper0,
          borderLeft: `1px solid ${tokens.color.rule}`,
          padding: 14,
          overflow: 'auto',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}># {room.name}</div>
        <Row gap={4} style={{ marginTop: 6 }}>
          <Badge>{room.visibility}</Badge>
          <Badge>{room.memberCount} members</Badge>
        </Row>
        <div style={{ height: 10 }} />
        <Meta>Owner</Meta>
        <div style={{ fontFamily: tokens.type.mono, fontSize: 13, marginTop: 4 }}>
          {detail?.owner.username}
        </div>
        {detail?.admins?.length ? (
          <>
            <div style={{ height: 10 }} />
            <Meta>Admins</Meta>
            <div style={{ marginTop: 4 }}>
              {detail.admins.map((a) => (
                <div key={a.id} style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
                  {a.username}
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div style={{ height: 10 }} />
        <Meta>Members</Meta>
        <div style={{ marginTop: 4 }}>
          {detail?.members?.map((m) => (
            <div key={m.user.id} style={{ margin: '2px 0' }}>
              <MemberRow userId={m.user.id} username={m.user.username} />
            </div>
          ))}
        </div>
        {detail && (detail.myRole === 'owner' || detail.myRole === 'admin') ? (
          <div style={{ marginTop: 12 }}>
            <Button size="sm" style={{ width: '100%' }} onClick={() => setManageOpen(true)}>
              Manage room
            </Button>
          </div>
        ) : null}
      </aside>
      {manageOpen && detail ? (
        <ManageRoomModal room={detail} onClose={() => setManageOpen(false)} />
      ) : null}
    </div>
  );
};

export default ChatView;
