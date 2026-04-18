import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { Toast, tokens } from '../../ds';
import { useConversations } from '../../features/conversations/useConversations';
import { useIncomingBans, useMyBans } from '../../features/friends/useFriends';
import { MessageList } from '../chat/MessageList';
import { Composer } from '../chat/Composer';
import { Sidebar } from '../chat/Sidebar';

type FreezeReason = null | 'banned-them' | 'banned-by-them';

const DmView = () => {
  const { username } = useParams<{ username: string }>();
  const { data } = useConversations();
  const { data: outgoing = [] } = useMyBans();
  const { data: incoming = [] } = useIncomingBans();

  const dm = useMemo(
    () => data?.dms.find((d) => d.otherUser.username === username),
    [data, username],
  );

  const freeze: FreezeReason = useMemo(() => {
    if (!dm) return null;
    if (outgoing.some((b) => b.target.id === dm.otherUser.id)) return 'banned-them';
    if (incoming.some((b) => b.banner.id === dm.otherUser.id)) return 'banned-by-them';
    return null;
  }, [dm, outgoing, incoming]);

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
          <div style={{ fontFamily: tokens.type.mono, fontSize: 14, fontWeight: 600 }}>
            @ {dm.otherUser.username}
          </div>
          <div style={{ fontFamily: tokens.type.sans, fontSize: 11, color: tokens.color.ink2 }}>
            direct message
          </div>
        </div>
        <MessageList conversationType="dm" conversationId={dm.id} />
        {freeze ? (
          <div
            style={{
              padding: '10px 12px',
              borderTop: `1px solid ${tokens.color.rule}`,
              background: tokens.color.paper1,
            }}
          >
            <Toast tone="warn" title="This conversation is frozen">
              {freeze === 'banned-them'
                ? `You've blocked ${dm.otherUser.username}. Unblock them from Contacts to send messages again — history stays read-only either way.`
                : `${dm.otherUser.username} has blocked you. Messages can't be sent, but prior history remains read-only.`}
            </Toast>
          </div>
        ) : (
          <Composer conversationType="dm" conversationId={dm.id} />
        )}
      </div>
    </div>
  );
};

export default DmView;
