import type { ReactNode } from 'react';
import { tokens } from './tokens';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

interface ToastProps {
  tone?: ToastTone;
  title?: string;
  children: ReactNode;
}

const tones: Record<ToastTone, { bd: string; bg: string; fg: string }> = {
  info: { bd: tokens.color.rule, bg: '#fffef6', fg: tokens.color.ink0 },
  success: { bd: tokens.color.online, bg: '#f1f8ef', fg: '#2a4a2a' },
  warn: { bd: tokens.color.afk, bg: '#fbf5e4', fg: '#5a4a2a' },
  error: { bd: tokens.color.danger, bg: tokens.color.dangerSoft, fg: '#6b2a20' },
};

export const Toast = ({ tone = 'info', title, children }: ToastProps) => {
  const t = tones[tone];
  return (
    <div
      style={{
        border: `1px solid ${t.bd}`,
        borderLeft: `3px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        padding: '8px 12px',
        fontFamily: tokens.type.sans,
        fontSize: 12,
        borderRadius: tokens.radius.xs,
        minWidth: 260,
      }}
    >
      {title ? <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div> : null}
      {children}
    </div>
  );
};
