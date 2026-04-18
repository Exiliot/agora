import type { CSSProperties, ReactNode } from 'react';
import { tokens } from './tokens';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'mention' | 'private';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  style?: CSSProperties;
}

const tones: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: tokens.color.paper2, fg: tokens.color.ink1, bd: tokens.color.rule },
  accent: { bg: tokens.color.accentSoft, fg: tokens.color.accentInk, bd: 'transparent' },
  danger: { bg: tokens.color.dangerSoft, fg: tokens.color.danger, bd: 'transparent' },
  mention: { bg: tokens.color.mentionBg, fg: tokens.color.mentionFg, bd: 'transparent' },
  private: { bg: '#efe9d8', fg: '#5a4a2a', bd: 'transparent' },
};

export const Badge = ({ children, tone = 'neutral', style }: BadgeProps) => {
  const t = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: tokens.radius.xs,
        fontSize: 11,
        fontFamily: tokens.type.mono,
        fontWeight: 500,
        letterSpacing: 0.2,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
