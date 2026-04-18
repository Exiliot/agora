import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Col, Input, Meta, Row, tokens } from '../../ds';
import { usePublicRooms } from '../../features/rooms/useRooms';
import { api } from '../../lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';

const PublicRoomsPage = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePublicRooms(search);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const join = async (roomId: string, roomName: string) => {
    await api.post(`/rooms/${roomId}/join`);
    qc.invalidateQueries({ queryKey: ['rooms'] });
    qc.invalidateQueries({ queryKey: ['conversations'] });
    navigate(`/chat/${roomName}`);
  };

  return (
    <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
      <div style={{ maxWidth: 720 }}>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: tokens.type.sans,
              fontSize: 18,
              fontWeight: 600,
              color: tokens.color.ink0,
            }}
          >
            Public rooms
          </h1>
          <Input
            placeholder="Search rooms…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            containerStyle={{ width: 260 }}
          />
        </Row>
        <div style={{ height: 16 }} />
        {isLoading ? <Meta>loading…</Meta> : null}
        <Col gap={8}>
          {(data ?? []).map((room) => (
            <div
              key={room.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '10px 12px',
                background: '#fff',
                border: `1px solid ${tokens.color.rule}`,
                borderRadius: tokens.radius.xs,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: tokens.type.mono, fontSize: 13 }}># {room.name}</div>
                {room.description ? (
                  <div style={{ fontSize: 12, color: tokens.color.ink2 }}>{room.description}</div>
                ) : null}
              </div>
              <Badge>{room.memberCount} members</Badge>
              <Button size="sm" onClick={() => void join(room.id, room.name)}>
                Join
              </Button>
            </div>
          ))}
          {!isLoading && (data ?? []).length === 0 ? (
            <div style={{ color: tokens.color.ink2, fontSize: 13 }}>
              no rooms found — create one from the sidebar.
            </div>
          ) : null}
        </Col>
      </div>
    </div>
  );
};

export default PublicRoomsPage;
