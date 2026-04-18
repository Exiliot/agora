export interface WsConnection {
  socket: WebSocket;
  close: () => void;
}

export const openWs = (path = '/ws'): WsConnection => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${scheme}://${window.location.host}${path}`;
  const socket = new WebSocket(url);
  return {
    socket,
    close: () => socket.close(),
  };
};

export const generateTabId = (): string => {
  const existing = sessionStorage.getItem('agora.tabId');
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  sessionStorage.setItem('agora.tabId', fresh);
  return fresh;
};
