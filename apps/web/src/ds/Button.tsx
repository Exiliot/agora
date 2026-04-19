import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { tokens } from './tokens';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'link' | 'linkDanger' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Busy state. Renders a trailing mono ellipsis as a visual cue, keeps the
   * written label intact for screen-reader users, and sets `aria-busy`. The
   * button is also disabled while pending. Prefer this to manually swapping
   * children to "…" – the ellipsis character reads as "horizontal ellipsis"
   * in most voices.
   */
  pending?: boolean;
  children: ReactNode;
}

const baseStyle: CSSProperties = {
  fontFamily: tokens.type.sans,
  fontWeight: 500,
  borderRadius: tokens.radius.xs,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  transition: 'background 80ms, border-color 80ms',
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { fontSize: 12, padding: '5px 10px' },
  md: { fontSize: 13, padding: '7px 14px' },
  lg: { fontSize: 14, padding: '10px 18px' },
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  default: {
    background: tokens.gradient.chrome,
    border: `1px solid ${tokens.color.rule}`,
    color: tokens.color.ink0,
    boxShadow: '0 1px 0 rgba(255,255,255,.7) inset, 0 1px 0 rgba(0,0,0,.03)',
  },
  primary: {
    background: tokens.color.accent,
    color: '#fff',
    border: `1px solid ${tokens.color.accentInk}`,
    boxShadow: '0 1px 0 rgba(255,255,255,.12) inset',
  },
  ghost: {
    background: 'transparent',
    color: tokens.color.ink0,
    border: '1px solid transparent',
  },
  link: {
    background: 'transparent',
    color: tokens.color.accent,
    border: '1px solid transparent',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  linkDanger: {
    background: 'transparent',
    color: tokens.color.danger,
    border: '1px solid transparent',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  danger: {
    background: '#fff',
    color: tokens.color.danger,
    border: `1px solid ${tokens.color.danger}`,
  },
};

export const Button = ({
  variant = 'default',
  size = 'md',
  disabled,
  pending = false,
  style,
  children,
  ...rest
}: ButtonProps) => {
  const isDisabled = disabled || pending;
  return (
    <button
      disabled={isDisabled}
      aria-busy={pending || undefined}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
      {pending ? (
        <span
          aria-hidden="true"
          style={{ marginLeft: 4, fontFamily: tokens.type.mono, letterSpacing: 1 }}
        >
          …
        </span>
      ) : null}
    </button>
  );
};
