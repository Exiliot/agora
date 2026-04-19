import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface SectionHeaderProps {
  children: ReactNode;
  /** Optional right-aligned slot — hint text, counter, or small action. */
  aside?: ReactNode;
  /**
   * Optional id applied to the heading element so a wrapping `<section>`
   * can reference it via `aria-labelledby`. When set, the heading renders
   * as an `<h2>` so screen-reader heading navigation can jump to it.
   */
  id?: string;
}

/**
 * Section label for pages that aggregate several lists under one PageShell
 * title (Contacts, Sessions, future admin surfaces). Reads as a mono
 * uppercase label with a hairline rule, so it sits one rung below the page
 * h1 without introducing a third sans heading tier.
 */
export const SectionHeader = ({ children, aside, id }: SectionHeaderProps) => {
  const headingStyle = {
    margin: 0,
    padding: 0,
    fontFamily: tokens.type.mono,
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: tokens.color.ink2,
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 0 6px',
        marginBottom: 10,
        borderBottom: `1px solid ${tokens.color.rule}`,
      }}
    >
      {id ? (
        <h2 id={id} style={headingStyle}>
          {children}
        </h2>
      ) : (
        <span style={headingStyle}>{children}</span>
      )}
      {aside ? (
        <span style={{ fontFamily: tokens.type.mono, fontSize: 11, color: tokens.color.ink3 }}>
          {aside}
        </span>
      ) : null}
    </div>
  );
};
