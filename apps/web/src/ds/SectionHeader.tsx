import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface SectionHeaderProps {
  children: ReactNode;
  /** Optional right-aligned slot — hint text, counter, or small action. */
  aside?: ReactNode;
}

/**
 * Section label for pages that aggregate several lists under one PageShell
 * title (Contacts, Sessions, future admin surfaces). Reads as a mono
 * uppercase label with a hairline rule, so it sits one rung below the page
 * h1 without introducing a third sans heading tier.
 */
export const SectionHeader = ({ children, aside }: SectionHeaderProps) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
      padding: '0 0 6px',
      marginBottom: 10,
      borderBottom: `1px solid ${tokens.color.rule}`,
      fontFamily: tokens.type.mono,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: tokens.color.ink2,
    }}
  >
    <span>{children}</span>
    {aside ? (
      <span style={{ fontFamily: tokens.type.mono, fontSize: 11, color: tokens.color.ink3 }}>
        {aside}
      </span>
    ) : null}
  </div>
);
