const KEY = 'agora.tabId';

export const generateTabId = (): string => {
  const existing = sessionStorage.getItem(KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  sessionStorage.setItem(KEY, fresh);
  return fresh;
};
