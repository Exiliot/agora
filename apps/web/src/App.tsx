import { useEffect, useState } from 'react';
import { generateTabId, openWs } from './lib/ws';

interface HealthPayload {
  status: string;
  db: boolean;
  ts: number;
}

const App = () => {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [wsStatus, setWsStatus] = useState<'idle' | 'connecting' | 'open' | 'closed'>('idle');
  const [echoReply, setEchoReply] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/health');
        const body = (await response.json()) as HealthPayload;
        if (!cancelled) setHealth(body);
      } catch {
        if (!cancelled) setHealth({ status: 'unreachable', db: false, ts: Date.now() });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setWsStatus('connecting');
    const { socket, close } = openWs('/ws');
    socket.onopen = () => {
      setWsStatus('open');
      socket.send(
        JSON.stringify({
          type: 'hello',
          reqId: `r_${crypto.randomUUID()}`,
          payload: { tabId: generateTabId(), openConversationIds: [] },
        }),
      );
      socket.send(
        JSON.stringify({
          type: 'echo',
          reqId: `r_${crypto.randomUUID()}`,
          payload: { text: 'hello from agora' },
        }),
      );
    };
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as { type: string; result?: { text?: string } };
        if (parsed.type === 'ack' && parsed.result?.text) setEchoReply(parsed.result.text);
      } catch {
        // ignore
      }
    };
    socket.onclose = () => setWsStatus('closed');
    return () => close();
  }, []);

  return (
    <div className="min-h-screen bg-paper-1 text-ink-0">
      <header className="flex items-center gap-2 border-b border-rule bg-paper-0 px-6 py-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xs bg-ink-0 font-serif text-xl italic text-paper-0"
        >
          a
        </span>
        <span className="font-serif text-2xl tracking-wide">agora</span>
        <span className="ml-3 font-mono text-[11px] uppercase tracking-wider text-ink-2">
          classic rooms
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif text-3xl text-ink-0">scaffolding · day 1</h1>
        <p className="mt-3 max-w-xl font-sans text-[13px] leading-relaxed text-ink-1">
          This is the agora scaffolding. No features yet — just a shell that confirms the
          full stack boots end-to-end. Once the delivery contract is green, real features go in
          through the ADLC loop.
        </p>

        <section className="mt-10 rounded-sm border border-rule bg-paper-0 p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-2">
            api · /health
          </div>
          <pre className="mt-2 overflow-auto font-mono text-[12px] text-ink-1">
            {health ? JSON.stringify(health, null, 2) : 'fetching…'}
          </pre>
        </section>

        <section className="mt-6 rounded-sm border border-rule bg-paper-0 p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-2">
            api · /ws echo
          </div>
          <div className="mt-2 font-mono text-[12px] text-ink-1">
            state: <span className="text-accent">{wsStatus}</span>
          </div>
          <div className="mt-1 font-mono text-[12px] text-ink-1">
            echo reply: <span className="text-accent">{echoReply ?? '—'}</span>
          </div>
        </section>

        <footer className="mt-12 font-mono text-[11px] text-ink-3">
          build: agora · hackathon · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
};

export default App;
