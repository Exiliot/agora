import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Badge } from './Badge';
import { tokens } from './tokens';

interface BellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  unreadCount: number;
}

/**
 * Topbar notification bell. 16x16 icon, Badge tone="mention" overlay when
 * unread > 0. Renders the count as mono for truth; "99+" when above 99 so the
 * pill doesn't stretch.
 */
export const Bell = forwardRef<HTMLButtonElement, BellProps>(
  ({ unreadCount, style, ...rest }, ref) => {
    const hasUnread = unreadCount > 0;
    const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);
    return (
      <button
        ref={ref}
        type="button"
        aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        style={{
          position: 'relative',
          width: 28,
          height: 28,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: hasUnread ? tokens.color.accent : tokens.color.ink1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
        {...rest}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1.5a3.5 3.5 0 00-3.5 3.5v2.6L3 10h10L11.5 7.6V5A3.5 3.5 0 008 1.5z"
            stroke="currentColor"
            strokeWidth={1.2}
            fill={hasUnread ? 'currentColor' : 'none'}
            strokeLinejoin="round"
          />
          <path
            d="M6.5 11.5a1.5 1.5 0 003 0"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </svg>
        {hasUnread ? (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              pointerEvents: 'none',
            }}
          >
            <Badge tone="mention">{displayCount}</Badge>
          </span>
        ) : null}
      </button>
    );
  },
);
Bell.displayName = 'Bell';
