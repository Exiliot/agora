import { useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { tokens } from './tokens';
import { useOverlay } from './useOverlay';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  width?: number;
  /** When true, body padding drops from 20 to 12 for compact forms. */
  dense?: boolean;
  /**
   * Heading level for the title. Default 2. Auth pages (where the Modal is
   * the page's only heading-bearing surface) pass 1 so the page has a real
   * h1. See ADR-0008.
   */
  titleLevel?: 1 | 2 | 3;
}

interface HeadingProps {
  level: 1 | 2 | 3;
  id: string;
  style: CSSProperties;
  children: ReactNode;
}

const Heading = ({ level, id, style, children }: HeadingProps) => {
  switch (level) {
    case 1:
      return (
        <h1 id={id} style={style}>
          {children}
        </h1>
      );
    case 3:
      return (
        <h3 id={id} style={style}>
          {children}
        </h3>
      );
    case 2:
    default:
      return (
        <h2 id={id} style={style}>
          {children}
        </h2>
      );
  }
};

export const Modal = ({
  title,
  children,
  onClose,
  width = 420,
  dense = false,
  titleLevel = 2,
}: ModalProps) => {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useOverlay({
    ref: rootRef,
    onClose: onClose ?? (() => {}),
    trapFocus: true,
    // Click-outside is handled by `ModalScrim`; the Modal itself only owns
    // Escape + focus trap + focus return.
    closeOnClickOutside: false,
    closeOnEscape: Boolean(onClose),
    open: true,
  });

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
        <Heading
          level={titleLevel}
          id={titleId}
          style={{ margin: 0, fontSize: 11, fontWeight: 600 }}
        >
          {title}
        </Heading>
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
