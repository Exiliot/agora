import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Col, Input, ListRow, Meta, PageShell, tokens } from '../../ds';
import { usePublicRooms, useMyRooms } from '../../features/rooms/useRooms';
import { api } from '../../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';

const PublicRoomsPage = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePublicRooms(search);
  const { data: myRooms = [] } = useMyRooms();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const myRoomIds = new Set(myRooms.map((r) => r.id));

  const join = async (roomId: string, roomName: string) => {
    await api.post(`/rooms/${roomId}/join`);
    qc.invalidateQueries({ queryKey: ['rooms'] });
    qc.invalidateQueries({ queryKey: ['conversations'] });
    navigate(`/chat/${roomName}`);
  };

  return (
    <PageShell
      title="Public rooms"
      actions={
        <Input
          placeholder="Search rooms…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          containerStyle={{ width: 240 }}
        />
      }
    >
      {isLoading ? <Meta>loading…</Meta> : null}
      <Col gap={8}>
        {(data ?? []).map((room) => {
          const isMember = myRoomIds.has(room.id);
          return (
            <ListRow
              key={room.id}
              title={`#${room.name}`}
              meta={room.description ?? undefined}
              actions={
                <>
                  <Badge>{room.memberCount} members</Badge>
                  {isMember ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/chat/${room.name}`)}
                    >
                      Open
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void join(room.id, room.name)}>
                      Join
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
        {!isLoading && (data ?? []).length === 0 ? (
          <div style={{ color: tokens.color.ink2, fontSize: 13 }}>
            no rooms found — create one from the sidebar.
          </div>
        ) : null}
      </Col>
    </PageShell>
  );
};

export default PublicRoomsPage;
