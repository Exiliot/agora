import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { tokens } from '../../ds';
import { useConversations } from '../../features/conversations/useConversations';
import { MessageList } from '../chat/MessageList';
import { Composer } from '../chat/Composer';
import { Sidebar } from '../chat/Sidebar';

const DmView = () => {
  const { username } = useParams<{ username: string }>();
  const { data } = useConversations();

  const dm = useMemo(
    () => data?.dms.find((d) => d.otherUser.username === username),
    [data, username],
  );

  if (!dm) {
    return (
      <div style={{ display: 'flex', flex: 1 }}>
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
          no direct message with {username} yet — open one from contacts.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${tokens.color.rule}`,
            background: tokens.color.paper1,
          }}
        >
          <div style={{ fontFamily: tokens.type.sans, fontSize: 14, fontWeight: 600 }}>
            @ {dm.otherUser.username}
          </div>
          <div style={{ fontSize: 11, color: tokens.color.ink2 }}>direct message</div>
        </div>
        <MessageList conversationType="dm" conversationId={dm.id} />
        <Composer conversationType="dm" conversationId={dm.id} />
      </div>
    </div>
  );
};

export default DmView;
