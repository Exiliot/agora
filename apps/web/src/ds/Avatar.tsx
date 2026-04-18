import { tokens } from './tokens';

const palette = ['#b38b59', '#6b8e6b', '#8a6f9e', '#a86a5c', '#5d7d8f', '#9a7b3f', '#7a6a5c'];

interface AvatarProps {
  name?: string;
  size?: number;
}

export const Avatar = ({ name = '?', size = 20 }: AvatarProps) => {
  const ch = name[0]?.toUpperCase() ?? '?';
  const idx = (name.charCodeAt(0) || 0) % palette.length;
  const bg = palette[idx] ?? '#7a6a5c';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        background: bg,
        color: '#fff',
        fontFamily: tokens.type.mono,
        fontWeight: 600,
        fontSize: Math.round(size * 0.5),
        borderRadius: tokens.radius.xs,
        letterSpacing: 0,
      }}
    >
      {ch}
    </span>
  );
};

/** Deterministic colour from a user's name — useful for message row nicknames. */
export const colorForName = (name: string): string => {
  const idx = (name.charCodeAt(0) || 0) % palette.length;
  return palette[idx] ?? '#7a6a5c';
};
