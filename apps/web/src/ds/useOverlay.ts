import { useEffect, useRef, type RefObject } from 'react';

interface UseOverlayArgs {
  /** Element that contains the overlay; click-outside is computed against this. */
  ref: RefObject<HTMLElement | null>;
  /** Called on Escape and on click-outside. */
  onClose: () => void;
  /**
   * When true, focus is moved into the overlay on mount, trapped on Tab /
   * Shift-Tab, and returned to the previously-focused element on close. Use
   * `true` for modals (`Modal`, `ConfirmModal`, `ImageLightbox`). Use `false`
   * for disclosure popovers (`NotificationMenu`) where tabbing out of the
   * panel is expected.
   */
  trapFocus: boolean;
  /** If true, click anywhere outside the overlay closes it. Default: true. */
  closeOnClickOutside?: boolean;
  /** If true, Escape closes. Default: true. */
  closeOnEscape?: boolean;
  /** Whether the overlay is currently mounted/visible. Hook is inert when false. */
  open: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable="true"]';

/**
 * Centralises the shared behaviour of every overlay surface: Escape-to-close,
 * click-outside-to-close, optional focus trap, and focus return on unmount.
 * See ADR-0008 for the contract. Internal to the DS – consumers live under
 * `apps/web/src/ds/`.
 */
export const useOverlay = ({
  ref,
  onClose,
  trapFocus,
  closeOnClickOutside = true,
  closeOnEscape = true,
  open,
}: UseOverlayArgs): void => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Capture the element that had focus before the overlay opened, so focus
  // returns on close.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;

    if (trapFocus && ref.current) {
      // Preference: an [autofocus] hint, else the first tabbable descendant,
      // else the panel itself if it's keyboard-addressable.
      const auto = ref.current.querySelector<HTMLElement>('[autofocus]');
      if (auto) {
        auto.focus();
      } else {
        const first = ref.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (first) {
          first.focus();
        } else if (ref.current.tabIndex >= 0) {
          ref.current.focus();
        }
      }
    }

    return () => {
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [open, trapFocus, ref]);

  // Escape + click-outside + focus trap on Tab.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (trapFocus && event.key === 'Tab' && ref.current) {
        const focusables = Array.from(
          ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!closeOnClickOutside) return;
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    // Defer click-outside for a tick so the click that opened the overlay
    // isn't immediately re-interpreted as a close.
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown);
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
      clearTimeout(t);
    };
  }, [open, onClose, trapFocus, closeOnClickOutside, closeOnEscape, ref]);
};
