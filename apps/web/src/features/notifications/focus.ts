import { useEffect } from 'react';
import { useWs } from '../../app/WsProvider';

type SubjectType = 'room' | 'dm' | 'user' | null;

export const useFocusBroadcast = (subjectType: SubjectType, subjectId: string | null) => {
  const ws = useWs();
  useEffect(() => {
    if (!ws) return;
    const send = () =>
      ws.send({
        type: 'client.focus',
        payload: { subjectType, subjectId },
      });
    send();
    const onVis = () => {
      if (document.visibilityState === 'visible') send();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      ws.send({ type: 'client.focus', payload: { subjectType: null, subjectId: null } });
    };
  }, [ws, subjectType, subjectId]);
};
