import { useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Col,
  ContactListItem,
  Input,
  Meta,
  Modal,
  Row,
  RoomListItem,
  tokens,
} from '../../ds';
import { useConversations } from '../../features/conversations/useConversations';
import { useCreateRoom } from '../../features/rooms/useCreateRoom';
import { usePresenceOf } from '../../app/WsProvider';

const DmRow = ({
  name,
  userId,
  unread,
  onClick,
}: {
  name: string;
  userId: string;
  unread: number;
  onClick: () => void;
}) => {
  const status = usePresenceOf(userId);
  return <ContactListItem name={name} status={status} unread={unread} onClick={onClick} />;
};
import { ApiError } from '../../lib/apiClient';
import type { RoomVisibility } from '@agora/shared';

const CreateRoomDialog = ({ onClose }: { onClose: () => void }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const createRoom = useCreateRoom();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,26,23,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div onClick={(event) => event.stopPropagation()}>
        <Modal title="Create room" width={380} onClose={onClose}>
          <Col gap={12}>
            <Input
              label="Name"
              value={name}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setName(event.target.value.toLowerCase())
              }
              placeholder="general"
            />
            <Input
              label="Description"
              value={description}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDescription(event.target.value)}
              placeholder="what's this room for?"
            />
            <Col gap={4}>
              <Meta>Visibility</Meta>
              <Row gap={12}>
                <label style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                  />{' '}
                  public
                </label>
                <label style={{ fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                  />{' '}
                  private
                </label>
              </Row>
            </Col>
            {error ? <div style={{ fontSize: 12, color: tokens.color.danger }}>{error}</div> : null}
            <Row gap={8} style={{ justifyContent: 'flex-end' }}>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={createRoom.isPending || !name}
                onClick={() => {
                  setError(null);
                  createRoom.mutate(
                    { name, description, visibility },
                    {
                      onSuccess: (room) => {
                        onClose();
                        navigate(`/chat/${room.name}`);
                      },
                      onError: (err) => {
                        if (err instanceof ApiError && err.body?.error === 'name_taken') {
                          setError('name already in use');
                        } else if (err instanceof Error) {
                          setError(err.message);
                        }
                      },
                    },
                  );
                }}
              >
                {createRoom.isPending ? '…' : 'Create'}
              </Button>
            </Row>
          </Col>
        </Modal>
      </div>
    </div>
  );
};

export const Sidebar = () => {
  const { roomName } = useParams<{ roomName: string }>();
  const { data, isLoading } = useConversations();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const publicRooms = (data?.rooms ?? []).filter((room) => room.visibility === 'public');
  const privateRooms = (data?.rooms ?? []).filter((room) => room.visibility === 'private');
  const dms = data?.dms ?? [];

  return (
    <aside
      style={{
        width: 240,
        background: tokens.color.paper1,
        borderRight: `1px solid ${tokens.color.rule}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '12px 12px 6px' }}>
        <Input placeholder="Search…" inputStyle={{ fontSize: 12, padding: '6px 8px' }} />
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ padding: '8px 12px 4px' }}>
          <Meta>Rooms</Meta>
        </div>
        {isLoading ? (
          <div style={{ padding: '4px 16px', fontSize: 12, color: tokens.color.ink3 }}>loading…</div>
        ) : null}
        {publicRooms.map((room) => (
          <RoomListItem
            key={room.id}
            name={room.name}
            unread={room.unreadCount}
            active={room.name === roomName}
            onClick={() => navigate(`/chat/${room.name}`)}
          />
        ))}
        {privateRooms.length > 0 ? (
          <>
            <div style={{ padding: '10px 12px 4px' }}>
              <Meta>Private</Meta>
            </div>
            {privateRooms.map((room) => (
              <RoomListItem
                key={room.id}
                name={room.name}
                unread={room.unreadCount}
                active={room.name === roomName}
                isPrivate
                onClick={() => navigate(`/chat/${room.name}`)}
              />
            ))}
          </>
        ) : null}
        <div style={{ padding: '10px 12px 4px' }}>
          <Meta>Contacts</Meta>
        </div>
        {dms.map((dm) => (
          <DmRow
            key={dm.id}
            name={dm.otherUser.username}
            userId={dm.otherUser.id}
            unread={dm.unreadCount}
            onClick={() => navigate(`/dm/${dm.otherUser.username}`)}
          />
        ))}
      </div>
      <div style={{ padding: 10, borderTop: `1px solid ${tokens.color.rule}` }}>
        <Button size="sm" style={{ width: '100%' }} onClick={() => setCreateOpen(true)}>
          + Create room
        </Button>
      </div>
      {createOpen ? <CreateRoomDialog onClose={() => setCreateOpen(false)} /> : null}
    </aside>
  );
};
