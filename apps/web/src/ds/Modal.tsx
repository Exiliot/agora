import { useEffect, useId, useRef, type ReactNode } from 'react';
import { tokens } from './tokens';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  width?: number;
  /** When true, body padding drops from 20 to 12 for compact forms. */
  dense?: boolean;
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({ title, children, onClose, width = 420, dense = false }: ModalProps) => {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape to close, focus trap, and focus restoration.
  useEffect(() => {
    const previouslyFocused = (document.activeElement as HTMLElement) ?? null;
    // Move focus into the modal on mount.
    const root = rootRef.current;
    if (root) {
      const first = root.querySelector<HTMLElement>(focusableSelector);
      (first ?? root).focus();
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab' && root) {
        const focusables = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
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
          padding: '7px 10px',
          background: tokens.gradient.chrome,
          borderBottom: `1px solid ${tokens.color.rule}`,
          fontFamily: tokens.type.sans,
          fontSize: 11,
          fontWeight: 600,
          color: tokens.color.ink0,
          letterSpacing: 0.2,
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="modal-close-btn"
          style={{
            fontFamily: tokens.type.mono,
            color: tokens.color.ink2,
            cursor: 'pointer',
            fontSize: 14,
            background: 'transparent',
            border: 'none',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radius.xs,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: dense ? 12 : 20 }}>{children}</div>
    </div>
  );
};
