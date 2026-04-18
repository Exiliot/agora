import type { PresenceState } from '@agora/shared/presence';
import { tokens } from './tokens';

interface PresenceProps {
  status?: PresenceState;
  label?: string;
  size?: number;
}

/**
 * Presence indicator. Shape + colour, never colour alone (NFR-A11Y-1).
 * - online:  filled square
 * - afk:     half-filled diagonal square
 * - offline: outlined empty square
 */
export const Presence = ({ status = 'online', label, size = 9 }: PresenceProps) => {
  const colour =
    status === 'online'
      ? tokens.color.online
      : status === 'afk'
        ? tokens.color.afk
        : tokens.color.offline;

  const box = {
    width: size,
    height: size,
    display: 'inline-block',
    verticalAlign: 'middle',
    marginRight: label ? 6 : 0,
    flexShrink: 0,
  } as const;

  let swatch;
  if (status === 'online') {
    swatch = <span style={{ ...box, background: colour }} />;
  } else if (status === 'afk') {
    swatch = (
      <span
        style={{
          ...box,
          background: `linear-gradient(135deg, ${colour} 50%, transparent 50%)`,
          border: `1px solid ${colour}`,
        }}
      />
    );
  } else {
    swatch = <span style={{ ...box, background: 'transparent', border: `1px solid ${colour}` }} />;
  }

  if (!label) return swatch;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: tokens.type.mono,
        fontSize: 12,
        color: tokens.color.ink1,
      }}
    >
      {swatch}
      {label}
    </span>
  );
};
