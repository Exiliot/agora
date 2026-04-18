import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RoomDetail, RoomRole } from '@agora/shared';
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

const roleOrder: Record<RoomRole, number> = { owner: 0, admin: 1, member: 2 };

interface RoomContextPanelProps {
  detail: RoomDetail & { myRole: RoomRole | null };
  memberCount: number;
  visibility: 'public' | 'private';
  canManage: boolean;
  onManage: () => void;
}

/**
 * Right-hand "who's in this room" column. All rows route through
 * ContactListItem so presence, unread pill and the mono `[name]` shape stay
 * consistent with the sidebar. Member count is a Meta label (not a Badge)
 * because it's a counter, not a role – per DS.
 */
const RoomContextPanel = ({
  detail,
  memberCount,
  visibility,
  canManage,
  onManage,
}: RoomContextPanelProps) => {
  const sorted = useMemo(
    () => detail.members.slice().sort((a, b) => roleOrder[a.role] - roleOrder[b.role]),
    [detail.members],
  );
  const owners = sorted.filter((m) => m.role === 'owner');
  const admins = sorted.filter((m) => m.role === 'admin');
  const regular = sorted.filter((m) => m.role === 'member');

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        flexShrink: 0,
        background: tokens.color.paper0,
        borderLeft: `1px solid ${tokens.color.rule}`,
        padding: 14,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: tokens.type.mono,
          fontSize: 14,
          fontWeight: 600,
          color: tokens.color.ink0,
          wordBreak: 'break-all',
        }}
      >
        # {detail.name}
      </div>
      <Row gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone={visibility === 'private' ? 'private' : 'neutral'}>{visibility}</Badge>
        <Meta>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </Meta>
      </Row>

      {owners.length > 0 ? (
        <div>
          <Meta>Owner</Meta>
          <div style={{ marginTop: 2 }}>
            {owners.map((m) => (
              <MemberRow key={m.user.id} userId={m.user.id} username={m.user.username} />
            ))}
          </div>
        </div>
      ) : null}

      {admins.length > 0 ? (
        <div>
          <Meta>Admins</Meta>
          <div style={{ marginTop: 2 }}>
            {admins.map((m) => (
              <MemberRow key={m.user.id} userId={m.user.id} username={m.user.username} />
            ))}
          </div>
        </div>
      ) : null}

      {regular.length > 0 ? (
        <div>
          <Meta>Members</Meta>
          <div style={{ marginTop: 2 }}>
            {regular.map((m) => (
              <MemberRow key={m.user.id} userId={m.user.id} username={m.user.username} />
            ))}
          </div>
        </div>
      ) : null}

      {canManage ? (
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <Button size="sm" style={{ width: '100%' }} onClick={onManage}>
            Manage room
          </Button>
        </div>
      ) : null}
    </aside>
  );
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
      {detail ? (
        <RoomContextPanel
          detail={detail}
          memberCount={room.memberCount}
          visibility={room.visibility}
          canManage={detail.myRole === 'owner' || detail.myRole === 'admin'}
          onManage={() => setManageOpen(true)}
        />
      ) : null}
      {manageOpen && detail ? (
        <ManageRoomModal room={detail} onClose={() => setManageOpen(false)} />
      ) : null}
    </div>
  );
};

export default ChatView;
