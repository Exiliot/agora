import type { ReactNode } from 'react';
import { Button } from './Button';
import { Col } from './Layout';
import { Modal } from './Modal';
import { ModalScrim } from './ModalScrim';
import { Row } from './Layout';
import { tokens } from './tokens';

interface ConfirmModalProps {
  title: string;
  /** The explanatory body. Prose is fine; can include the resource name. */
  children: ReactNode;
  /** Label for the confirm button – typically a verb: "Delete", "Revoke". */
  confirmLabel: string;
  /** Tone of the confirm button. Default: `danger`. */
  tone?: 'danger' | 'primary';
  /** Cancel button copy override (default "Cancel"). */
  cancelLabel?: string;
  /** Disables the confirm button while the underlying mutation is pending. */
  pending?: boolean;
  /**
   * Forwarded to the underlying Modal. Default 2. See ADR-0008.
   */
  titleLevel?: 1 | 2 | 3;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog for destructive or high-commitment actions. Replaces native
 * `window.confirm` calls so the confirm surface matches the rest of the app.
 * Cancel sits on the left, the confirm action on the right per the DS spec.
 */
export const ConfirmModal = ({
  title,
  children,
  confirmLabel,
  tone = 'danger',
  cancelLabel = 'Cancel',
  pending = false,
  titleLevel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => (
  <ModalScrim onClose={onCancel} zIndex={20}>
    <Modal
      title={title}
      width={420}
      onClose={onCancel}
      {...(titleLevel !== undefined ? { titleLevel } : {})}
    >
      <Col gap={14}>
        <div style={{ fontSize: 13, color: tokens.color.ink1, lineHeight: 1.55 }}>{children}</div>
        <Row gap={8} style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={pending}>
            {pending ? '…' : confirmLabel}
          </Button>
        </Row>
      </Col>
    </Modal>
  </ModalScrim>
);
