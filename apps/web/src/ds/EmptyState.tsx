import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface EmptyStateProps {
  caption: string;
  hint?: string;
  action?: ReactNode;
}

/**
 * Standard "nothing here yet" block. Mono caption keeps it consistent with
 * the rest of the chat-chrome language (timestamps, ids); sans hint softens
 * the follow-up sentence; optional action is usually a `<Button>`.
 */
export const EmptyState = ({ caption, hint, action }: EmptyStateProps) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 12px',
    }}
  >
    <div
      style={{
        fontFamily: tokens.type.mono,
        fontSize: 13,
        color: tokens.color.ink2,
      }}
    >
      {caption}
    </div>
    {hint ? (
      <div
        style={{
          marginTop: 6,
          fontFamily: tokens.type.sans,
          fontSize: 13,
          color: tokens.color.ink3,
        }}
      >
        {hint}
      </div>
    ) : null}
    {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
  </div>
);
