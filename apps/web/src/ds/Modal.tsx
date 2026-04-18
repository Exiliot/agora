import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  width?: number;
}

export const Modal = ({ title, children, onClose, width = 420 }: ModalProps) => (
  <div
    style={{
      width,
      background: '#fff',
      border: `1px solid ${tokens.color.rule}`,
      borderRadius: tokens.radius.sm,
      boxShadow: '0 4px 16px rgba(0,0,0,.08), 0 1px 0 rgba(255,255,255,.6) inset',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 12px',
        background: 'linear-gradient(180deg, #f6f1df 0%, #ede7d1 100%)',
        borderBottom: `1px solid ${tokens.color.rule}`,
        fontFamily: tokens.type.sans,
        fontSize: 12,
        fontWeight: 600,
        color: tokens.color.ink0,
        letterSpacing: 0.1,
      }}
    >
      <span>{title}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          fontFamily: tokens.type.mono,
          color: tokens.color.ink2,
          cursor: 'pointer',
          fontSize: 14,
          background: 'transparent',
          border: 'none',
        }}
      >
        ×
      </button>
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);
