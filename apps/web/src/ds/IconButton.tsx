import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { tokens } from './tokens';

type IconButtonSize = 20 | 24 | 28;
type IconButtonTone = 'neutral' | 'danger';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  size?: IconButtonSize;
  tone?: IconButtonTone;
  'aria-label': string;
  children: ReactNode;
}

/**
 * Square, icon-only button with a predictable hit area and a single hover
 * wash. Children is free-form – an inline SVG glyph, a single-char label,
 * whatever fits the slot.
 */
export const IconButton = ({
  size = 24,
  tone = 'neutral',
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: IconButtonProps) => {
  const [hover, setHover] = useState(false);

  const restColour = tone === 'danger' ? tokens.color.danger : tokens.color.ink2;
  const hoverColour = tone === 'danger' ? tokens.color.danger : tokens.color.ink0;

  return (
    <button
      type="button"
      onMouseEnter={(event) => {
        setHover(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setHover(false);
        onMouseLeave?.(event);
      }}
      style={{
        width: size,
        height: size,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? 'rgba(0,0,0,0.05)' : 'transparent',
        border: 'none',
        borderRadius: tokens.radius.xs,
        color: hover ? hoverColour : restColour,
        cursor: 'pointer',
        transition: 'background 80ms, color 80ms',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
