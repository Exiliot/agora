import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomDetail, RoomRole } from '@agora/shared';
import {
  Badge,
  Button,
  Col,
  ConfirmModal,
  Input,
  Meta,
  Modal,
  ModalScrim,
  Row,
  TabBar,
  Table,
  Toast,
  tokens,
} from '../../ds';
import { ApiError } from '../../lib/apiClient';
import {
  useDeleteRoom,
  useDemoteAdmin,
  useInviteToRoom,
  usePromoteAdmin,
  useRemoveMember,
  useRoomBans,
  useUnbanFromRoom,
} from '../../features/rooms/useRoomAdmin';

// M13: map server invite-error codes to human-readable prose. Anything we
// haven't seen before falls through to the raw err.message (still better
// than a blank toast, and surfaces the unknown code for diagnosis).
const inviteErrorCopy = (err: unknown): string => {
  if (err instanceof ApiError) {
    const code = err.body?.code ?? err.body?.error;
    switch (code) {
      case 'not_private':
        return 'this room is public – anyone can join without an invite';
      case 'not_member':
        return 'you need to be a member of this room to invite';
      case 'user_not_found':
      case 'not_found':
        return 'no such user';
      case 'self_invite':
        return "you can't invite yourself";
      case 'already_member':
        return "they're already in this room";
      case 'target_banned':
        return 'that user is banned from this room';
      case 'already_invited':
        return 'they already have a pending invitation';
      default:
        return err.body?.message ?? 'could not send invite';
    }
  }
  return err instanceof Error ? err.message : 'could not send invite';
};

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
  // M12: removing a member is destructive (it also inserts a ban row). Route
  // through ConfirmModal so a mis-click on the red button doesn't fire.
  const [confirmBan, setConfirmBan] = useState<{ id: string; username: string } | null>(
    null,
  );
  return (
    <>
      <Table
        caption="Room members"
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
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmBan({ id: m.user.id, username: m.user.username })}
              >
                Ban
              </Button>
            ) : null}
          </Row>,
        ])}
      />
      {confirmBan ? (
        <ConfirmModal
          title="Ban member"
          confirmLabel="Ban"
          pending={remove.isPending}
          onCancel={() => setConfirmBan(null)}
          onConfirm={() =>
            remove.mutate(confirmBan.id, {
              onSettled: () => setConfirmBan(null),
            })
          }
        >
          Remove{' '}
          <span style={{ fontFamily: tokens.type.mono }}>{confirmBan.username}</span> from{' '}
          <span style={{ fontFamily: tokens.type.mono }}>#{room.name}</span> and add them to
          the room ban list? They won't be able to rejoin until you unban them.
        </ConfirmModal>
      ) : null}
    </>
  );
};

const AdminsTab = ({ room }: { room: ManageRoomModalProps['room'] }) => {
  const demote = useDemoteAdmin(room.id);
  const amOwner = room.myRole === 'owner';
  const ownerRow: typeof room.members[number] = room.members.find((m) => m.role === 'owner') ?? {
    user: room.owner,
    role: 'owner' as RoomRole,
    joinedAt: room.createdAt,
  };
  const admins = room.members.filter((m) => m.role === 'admin');

  const renderRow = (
    member: typeof room.members[number],
    roleBadge: ReactNode,
    action: ReactNode,
  ): ReactNode[] => [
    <span key="u" style={{ fontFamily: tokens.type.mono, fontSize: 13 }}>
      {member.user.username}
    </span>,
    roleBadge,
    action,
  ];

  return (
    <Table
      caption="Room owner and admins"
      cols={['Username', 'Role', 'Actions']}
      rows={[
        renderRow(ownerRow, <Badge tone="accent">owner</Badge>, <Meta>locked</Meta>),
        ...admins.map((m) =>
          renderRow(
            m,
            <Badge>admin</Badge>,
            amOwner ? (
              <Button size="sm" onClick={() => demote.mutate(m.user.id)}>
                Remove admin
              </Button>
            ) : (
              <Meta>–</Meta>
            ),
          ),
        ),
      ]}
    />
  );
};

const BannedTab = ({ roomId }: { roomId: string }) => {
  const { data = [] } = useRoomBans(roomId);
  const unban = useUnbanFromRoom(roomId);
  const [confirmUnban, setConfirmUnban] = useState<{ id: string; username: string } | null>(
    null,
  );
  if (data.length === 0) return <Meta>no one is currently banned</Meta>;
  return (
    <>
      <Table
        caption="Users banned from this room"
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
          <Button
            key="a"
            size="sm"
            onClick={() => setConfirmUnban({ id: b.target.id, username: b.target.username })}
          >
            Unban
          </Button>,
        ])}
      />
      {confirmUnban ? (
        <ConfirmModal
          title="Lift ban"
          confirmLabel="Unban"
          tone="primary"
          pending={unban.isPending}
          onCancel={() => setConfirmUnban(null)}
          onConfirm={() =>
            unban.mutate(confirmUnban.id, {
              onSettled: () => setConfirmUnban(null),
            })
          }
        >
          Lift the ban on{' '}
          <span style={{ fontFamily: tokens.type.mono }}>{confirmUnban.username}</span>? They
          will be able to rejoin this room.
        </ConfirmModal>
      ) : null}
    </>
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
          {...(error ? { errorMessage: error } : {})}
        />
        <Button
          variant="primary"
          disabled={!username || invite.isPending}
          onClick={() => {
            setError(null);
            setOk(null);
            invite.mutate(username, {
              onSuccess: () => setOk(`invited ${username}`),
              onError: (err) => setError(inviteErrorCopy(err)),
            });
            setUsername('');
          }}
        >
          Send invite
        </Button>
      </Row>
      {ok ? <Toast tone="success">{ok}</Toast> : null}
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete room
          </Button>
        </Row>
      ) : null}
      {confirmDelete ? (
        <ConfirmModal
          title="Delete room"
          confirmLabel="Delete room"
          pending={delMut.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            delMut.mutate(room.id, {
              onSuccess: () => {
                setConfirmDelete(false);
                onDeleted();
                navigate('/chat');
              },
            })
          }
        >
          Delete{' '}
          <span style={{ fontFamily: tokens.type.mono }}>#{room.name}</span>? The room, its
          messages and its attachments will be removed for everyone. This can't be undone.
        </ConfirmModal>
      ) : null}
    </Col>
  );
};

export const ManageRoomModal = ({ room, onClose }: ManageRoomModalProps) => {
  // M10: Invitations only make sense on private rooms – the API rejects
  // invites on public rooms with `not_private`. Hide the tab (and shift the
  // Settings index accordingly) for public rooms so the owner never sees a
  // control that can only error.
  const isPrivate = room.visibility === 'private';
  const tabs = isPrivate
    ? ['Members', 'Admins', 'Banned users', 'Invitations', 'Settings']
    : ['Members', 'Admins', 'Banned users', 'Settings'];
  const [active, setActive] = useState(0);
  const settingsIndex = isPrivate ? 4 : 3;
  const invitationsIndex = isPrivate ? 3 : -1;

  return (
    <ModalScrim onClose={onClose}>
      <Modal title={`Manage · #${room.name}`} width={560} onClose={onClose}>
          <Col gap={12}>
            <TabBar items={tabs} active={active} onSelect={setActive} />
            {active === 0 ? <MembersTab room={room} /> : null}
            {active === 1 ? <AdminsTab room={room} /> : null}
            {active === 2 ? <BannedTab roomId={room.id} /> : null}
            {active === invitationsIndex ? <InviteTab roomId={room.id} /> : null}
            {active === settingsIndex ? <SettingsTab room={room} onDeleted={onClose} /> : null}
          </Col>
      </Modal>
    </ModalScrim>
  );
};
