import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RoomDetail, RoomRole } from '@agora/shared';
import { useMyRooms } from '../../features/rooms/useRooms';
import { useRoom } from '../../features/rooms/useRoom';
import { useFocusBroadcast } from '../../features/notifications/focus';
import { Badge, Button, ContactListItem, Meta, Row, tokens } from '../../ds';

// Small padlock glyph used in the (slim) room header and the dossier aside
// to flag private rooms. Sized to sit next to the name without crowding.
const LockIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.25" y="5.25" width="7.5" height="5.25" rx="1" />
    <path d="M4 5.25V3.5a2 2 0 0 1 4 0v1.75" />
  </svg>
);
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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: tokens.type.mono,
          fontSize: 14,
          fontWeight: 600,
          color: tokens.color.ink0,
          wordBreak: 'break-all',
        }}
      >
        <span>#{detail.name}</span>
        {visibility === 'private' ? (
          <span style={{ color: tokens.color.ink2, display: 'inline-flex' }}>
            <LockIcon />
          </span>
        ) : null}
      </div>
      {detail.description ? (
        <div style={{ fontFamily: tokens.type.sans, fontSize: 12, color: tokens.color.ink2 }}>
          {detail.description}
        </div>
      ) : null}
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

const RoomHeader = ({
  roomName,
  visibility,
}: {
  roomName: string;
  visibility: string;
}) => (
  <div
    style={{
      padding: '10px 16px',
      borderBottom: `1px solid ${tokens.color.rule}`,
      background: tokens.color.paper1,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: tokens.type.mono,
      fontSize: 14,
      fontWeight: 600,
      color: tokens.color.ink0,
    }}
  >
    <span>#{roomName}</span>
    {visibility === 'private' ? (
      <span
        aria-label="private room"
        style={{ color: tokens.color.ink2, display: 'inline-flex' }}
      >
        <LockIcon />
      </span>
    ) : null}
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

  useFocusBroadcast('room', room?.id ?? null);

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
        <RoomHeader roomName={room.name} visibility={room.visibility} />
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
