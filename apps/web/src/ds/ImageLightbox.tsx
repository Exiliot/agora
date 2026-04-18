import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ModalScrim } from './ModalScrim';
import { tokens } from './tokens';

interface ImageLightboxProps {
  /** URL of the image to show. Usually the attachment download endpoint —
   *  the browser carries the session cookie so the server ACL still runs. */
  src: string;
  /** Alt text / accessible description. */
  alt: string;
  /** Optional caption (filename, size, comment). Mono, ink-2. */
  caption?: string;
  /** Shown in the top-right as a secondary action. */
  downloadHref?: string;
  onClose: () => void;
}

/**
 * Full-view image preview. Click the scrim or press Esc to close; the
 * scrim wrapper handles both. A small top-right strip carries close + an
 * optional "Download" link so users can still grab the original bytes
 * instead of only seeing the inline preview.
 */
export const ImageLightbox = ({ src, alt, caption, downloadHref, onClose }: ImageLightboxProps) => {
  // Esc is already handled by Modal, but the lightbox doesn't use Modal
  // because it has no title chrome — catch it directly here.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal to <body> so the fixed-position scrim escapes any transformed
  // ancestor (e.g. the virtualised message row, which uses translateY and
  // would otherwise anchor position:fixed to itself instead of the viewport).
  return createPortal(
    <ModalScrim onClose={onClose} zIndex={50}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 8,
          maxWidth: '92vw',
          maxHeight: '92vh',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 14,
            padding: '0 2px',
            fontFamily: tokens.type.mono,
            fontSize: 12,
            color: '#f5f1e3',
          }}
        >
          {downloadHref ? (
            <a
              href={downloadHref}
              download
              style={{
                color: '#f5f1e3',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              download original
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: '1px solid rgba(245,241,227,0.4)',
              color: '#f5f1e3',
              fontFamily: tokens.type.mono,
              fontSize: 12,
              padding: '2px 8px',
              cursor: 'pointer',
              borderRadius: tokens.radius.xs,
            }}
          >
            close · esc
          </button>
        </div>
        <img
          src={src}
          alt={alt}
          onClick={(event) => event.stopPropagation()}
          style={{
            maxWidth: '92vw',
            maxHeight: '82vh',
            objectFit: 'contain',
            background: '#000',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            cursor: 'default',
          }}
        />
        {caption ? (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              fontFamily: tokens.type.mono,
              fontSize: 12,
              color: '#f5f1e3',
              padding: '0 2px',
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </ModalScrim>,
    document.body,
  );
};
