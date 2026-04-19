import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface ListRowProps {
  /** Leading element — icon, avatar, # symbol, etc. */
  lead?: ReactNode;
  /** Primary text — usually mono for channel/@handle rendering. */
  title: ReactNode;
  /** Secondary line — short description or byline. */
  meta?: ReactNode;
  /** Right-aligned actions — Button(s) or Badge(s). */
  actions?: ReactNode;
  onClick?: () => void;
}

/**
 * Shared row for tabular lists: public rooms, friend requests, invitations,
 * bans. Replaces five ad-hoc inline divs that were redoing the same padding +
 * border + bg every time. Hover fill lives on `:hover` via inline-style trick
 * kept to one place so further drift is impossible.
 */
export const ListRow = ({ lead, title, meta, actions, onClick }: ListRowProps) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={
      onClick
        ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onClick();
            }
          }
        : undefined
    }
    className={onClick ? 'ds-row-hoverable' : undefined}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '10px 12px',
      background: tokens.color.paper0,
      border: `1px solid ${tokens.color.rule}`,
      borderRadius: tokens.radius.xs,
      cursor: onClick ? 'pointer' : undefined,
    }}
  >
    {lead ? <div style={{ flexShrink: 0 }}>{lead}</div> : null}
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontFamily: tokens.type.mono, fontSize: 13, color: tokens.color.ink0 }}>
        {title}
      </div>
      {meta ? (
        <div
          style={{
            marginTop: 2,
            fontFamily: tokens.type.sans,
            fontSize: 12,
            color: tokens.color.ink2,
          }}
        >
          {meta}
        </div>
      ) : null}
    </div>
    {actions ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{actions}</div>
    ) : null}
  </div>
);
