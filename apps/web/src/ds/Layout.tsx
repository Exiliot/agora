import type { CSSProperties, ReactNode } from 'react';
import { tokens } from './tokens';

interface RowProps {
  children: ReactNode;
  gap?: number;
  align?: CSSProperties['alignItems'];
  wrap?: boolean;
  style?: CSSProperties;
}

export const Row = ({ children, gap = 10, align = 'center', wrap = false, style }: RowProps) => (
  <div
    style={{
      display: 'flex',
      gap,
      alignItems: align,
      flexWrap: wrap ? 'wrap' : 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

interface ColProps {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}

export const Col = ({ children, gap = 8, style }: ColProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>{children}</div>
);

export const Meta = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontFamily: tokens.type.mono,
      fontSize: 10,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: tokens.color.ink2,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Divider = ({ vertical = false, style }: { vertical?: boolean; style?: CSSProperties }) =>
  vertical ? (
    <div
      style={{ width: 1, alignSelf: 'stretch', background: tokens.color.rule, ...style }}
    />
  ) : (
    <div style={{ height: 1, background: tokens.color.rule, ...style }} />
  );
