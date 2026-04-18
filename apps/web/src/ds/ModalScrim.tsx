import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface ModalScrimProps {
  onClose: () => void;
  children: ReactNode;
  /** z-index override for stacked dialogs (defaults to 10). */
  zIndex?: number;
}

/**
 * Single scrim wrapper for every dialog. Centralises the click-outside-to-
 * close behaviour and the `tokens.color.scrim` rgba so the two prior
 * inlined `rgba(26,26,23,0.35)` sites can't drift again.
 */
export const ModalScrim = ({ onClose, children, zIndex = 10 }: ModalScrimProps) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: tokens.color.scrim,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex,
    }}
    onClick={onClose}
  >
    <div onClick={(event) => event.stopPropagation()}>{children}</div>
  </div>
);
