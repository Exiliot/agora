import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Standard shell for full-width content pages (Contacts, Sessions, Public
 * rooms). Centralises the 20×24 padding and 720-max column so the three
 * pages can't drift from the spec again. Title is sans 18/600, subtitle is
 * 12/ink-2 — page headings are never serif per the DS.
 */
export const PageShell = ({ title, subtitle, actions, children }: PageShellProps) => (
  <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: tokens.type.sans,
              fontSize: 18,
              fontWeight: 600,
              color: tokens.color.ink0,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <div
              style={{
                marginTop: 4,
                fontFamily: tokens.type.sans,
                fontSize: 12,
                color: tokens.color.ink2,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div style={{ height: 16 }} />
      {children}
    </div>
  </div>
);
