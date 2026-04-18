import type { HTMLAttributes, ReactNode } from 'react';
import { tokens } from './tokens';

interface NavTabProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}

export const NavTab = ({ active, danger, children, style, ...rest }: NavTabProps) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 14px',
      fontFamily: tokens.type.sans,
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      color: danger ? tokens.color.danger : active ? tokens.color.ink0 : tokens.color.ink1,
      borderBottom: active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
      cursor: 'pointer',
      ...style,
    }}
    {...rest}
  >
    {children}
  </span>
);
