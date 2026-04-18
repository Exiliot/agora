import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { tokens } from './tokens';

type NavTabBase = {
  active?: boolean;
  danger?: boolean;
  /** Tabs in the primary nav get the active-underline treatment; the
   *  right-side actions (username label, Sign out) pass `plain` to opt out
   *  so they don't read as "also a tab". */
  plain?: boolean;
  children: ReactNode;
};

type NavTabSpanProps = NavTabBase & { as?: 'span' } & HTMLAttributes<HTMLSpanElement>;
type NavTabButtonProps = NavTabBase & { as: 'button' } & ButtonHTMLAttributes<HTMLButtonElement>;
type NavTabProps = NavTabSpanProps | NavTabButtonProps;

const baseStyle = (active: boolean, danger: boolean, plain: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '12px 14px',
  fontFamily: tokens.type.sans,
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  color: danger ? tokens.color.danger : active ? tokens.color.ink0 : tokens.color.ink1,
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: plain
    ? 'none'
    : active
      ? `2px solid ${tokens.color.accent}`
      : '2px solid transparent',
  cursor: plain && !danger ? 'default' : 'pointer',
  background: 'transparent',
});

export const NavTab = (props: NavTabProps) => {
  const { active = false, danger = false, plain = false, children, style, ...rest } = props;
  if (props.as === 'button') {
    const { as: _as, ...buttonProps } = rest as NavTabButtonProps;
    return (
      <button
        type="button"
        style={{ ...baseStyle(active, danger, plain), ...style }}
        {...buttonProps}
      >
        {children}
      </button>
    );
  }
  const { as: _as, ...spanProps } = rest as NavTabSpanProps;
  return (
    <span style={{ ...baseStyle(active, danger, plain), ...style }} {...spanProps}>
      {children}
    </span>
  );
};
