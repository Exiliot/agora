import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomDetail, RoomRole } from '@agora/shared';
import {
  Badge,
  Button,
  Col,
  Input,
  Meta,
  Modal,
  Row,
  TabBar,
  Table,
  tokens,
} from '../../ds';
import {
  useDeleteRoom,
  useDemoteAdmin,
  useInviteToRoom,
  usePromoteAdmin,
  useRemoveMember,
  useRoomBans,
  useUnbanFromRoom,
} from '../../features/rooms/useRoomAdmin';

interface ManageRoomModalProps {
  room: RoomDetail & { myRole: RoomRole | null };
  onClose: () => void;
}

const MembersTab = ({ room }: { room: ManageRoomModalProps['room'] }) => {
  const promote = usePromoteAdmin(room.id);
  const demote = useDemoteAdmin(room.id);
  const remove = useRemoveMember(room.id);
  const amOwner = room.myRole === 'owner';
  const amAdmin = room.myRole === 'admin' || amOwner;
  return (
    <Table
      cols={['Username', 'Role', 'Actions']}
      rows={room.members.map((m) => [
        <span key="u" style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
          {m.user.username}
        </span>,
        <Badge key="r" tone={m.role === 'owner' ? 'accent' : 'neutral'}>
          {m.role}
        </Badge>,
        <Row key="a" gap={6}>
          {amOwner && m.role === 'member' ? (
            <Button size="sm" onClick={() => promote.mutate(m.user.id)}>
              Make admin
            </Button>
          ) : null}
          {amOwner && m.role === 'admin' ? (
            <Button size="sm" onClick={() => demote.mutate(m.user.id)}>
              Remove admin
            </Button>
          ) : null}
          {amAdmin && m.role !== 'owner' && m.user.id !== room.owner.id ? (
            <Button size="sm" variant="danger" onClick={() => remove.mutate(m.user.id)}>
              Ban
            </Button>
          ) : null}
        </Row>,
      ])}
    />
  );
};

const BannedTab = ({ roomId }: { roomId: string }) => {
  const { data = [] } = useRoomBans(roomId);
  const unban = useUnbanFromRoom(roomId);
  if (data.length === 0) return <Meta>no one is currently banned</Meta>;
  return (
    <Table
      cols={['User', 'Banned by', 'When', '']}
      rows={data.map((b) => [
        <span key="u" style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
          {b.target.username}
        </span>,
        <span key="w" style={{ fontFamily: tokens.type.mono, fontSize: 12 }}>
          {b.banner?.username ?? '(deleted)'}
        </span>,
        <span key="t" style={{ fontSize: 11, color: tokens.color.ink2 }}>
          {new Date(b.createdAt).toLocaleString()}
        </span>,
        <Button key="a" size="sm" onClick={() => unban.mutate(b.target.id)}>
          Unban
        </Button>,
      ])}
    />
  );
};

const InviteTab = ({ roomId }: { roomId: string }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const invite = useInviteToRoom(roomId);
  return (
    <Col gap={10}>
      <Row gap={6} style={{ alignItems: 'flex-end' }}>
        <Input
          label="Invite by username"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          placeholder="bob"
        />
        <Button
          variant="primary"
          disabled={!username || invite.isPending}
          onClick={() => {
            setError(null);
            setOk(null);
            invite.mutate(username, {
              onSuccess: () => setOk(`invited ${username}`),
              onError: (err) => setError(err instanceof Error ? err.message : 'failed'),
            });
            setUsername('');
          }}
        >
          Send invite
        </Button>
      </Row>
      {ok ? <div style={{ fontSize: 12, color: tokens.color.online }}>{ok}</div> : null}
      {error ? <div style={{ fontSize: 12, color: tokens.color.danger }}>{error}</div> : null}
    </Col>
  );
};

const SettingsTab = ({
  room,
  onDeleted,
}: {
  room: ManageRoomModalProps['room'];
  onDeleted: () => void;
}) => {
  const delMut = useDeleteRoom();
  const navigate = useNavigate();
  return (
    <Col gap={12}>
      <Meta>Name</Meta>
      <div style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>{room.name}</div>
      <Meta>Description</Meta>
      <div style={{ fontSize: 13 }}>{room.description ?? '(none)'}</div>
      <Meta>Visibility</Meta>
      <div>
        <Badge tone={room.visibility === 'private' ? 'private' : 'neutral'}>{room.visibility}</Badge>
      </div>
      {room.myRole === 'owner' ? (
        <Row gap={8} style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(`Delete #${room.name}? This cannot be undone.`)) return;
              delMut.mutate(room.id, {
                onSuccess: () => {
                  onDeleted();
                  navigate('/chat');
                },
              });
            }}
          >
            Delete room
          </Button>
        </Row>
      ) : null}
    </Col>
  );
};

export const ManageRoomModal = ({ room, onClose }: ManageRoomModalProps) => {
  const tabs = ['Members', 'Banned', 'Invite', 'Settings'];
  const [active, setActive] = useState(0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.color.scrim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div onClick={(event) => event.stopPropagation()}>
        <Modal title={`Manage · # ${room.name}`} width={560} onClose={onClose}>
          <Col gap={12}>
            <TabBar items={tabs} active={active} onSelect={setActive} />
            {active === 0 ? <MembersTab room={room} /> : null}
            {active === 1 ? <BannedTab roomId={room.id} /> : null}
            {active === 2 ? <InviteTab roomId={room.id} /> : null}
            {active === 3 ? <SettingsTab room={room} onDeleted={onClose} /> : null}
          </Col>
        </Modal>
      </div>
    </div>
  );
};
