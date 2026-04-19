import { tokens } from './tokens';

interface DaySeparatorProps {
  /** Date for the standard day-break separator. Accepts an ISO string or a
   *  `Date`. Ignored when `label` is provided. */
  date?: Date | string;
  /** Optional literal label – takes precedence over `date`. Used for the
   *  "start of conversation" marker so one component covers both needs. */
  label?: string;
}

const formatDateLabel = (value: Date | string): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (sameDay) return 'Today';
  if (sameYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Horizontal rule-bracketed label used to break up the message stream on
 * day boundaries, and – with an explicit `label` – to mark the top of
 * conversation. Identical visual output for both modes by design.
 */
export const DaySeparator = ({ date, label }: DaySeparatorProps) => {
  const text = label ?? (date !== undefined ? formatDateLabel(date) : '');
  return (
    <div
      role="separator"
      aria-label={text}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px 6px',
        fontFamily: tokens.type.mono,
        fontSize: 11,
        color: tokens.color.ink2,
        letterSpacing: 0.2,
      }}
    >
      <span style={{ flex: 1, height: 1, background: tokens.color.rule }} aria-hidden="true" />
      <span style={{ flexShrink: 0 }}>{text}</span>
      <span style={{ flex: 1, height: 1, background: tokens.color.rule }} aria-hidden="true" />
    </div>
  );
};
