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
    // Drawn as SVG instead of a CSS gradient + 1px border — the old approach
    // made the unfilled half read as an outlined rectangle with a streak
    // because the border wrapped the transparent triangle as well. Now: an
    // outlined square with the top-left triangle filled, matching the 135deg
    // "colour 50%, transparent 50%" original (gradient start = top-left).
    swatch = (
      <svg
        style={box}
        width={size}
        height={size}
        viewBox="0 0 9 9"
        aria-hidden="true"
      >
        <path d="M0,0 L9,0 L0,9 Z" fill={colour} />
        <rect
          x="0.5"
          y="0.5"
          width="8"
          height="8"
          fill="none"
          stroke={colour}
          strokeWidth="1"
        />
      </svg>
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
