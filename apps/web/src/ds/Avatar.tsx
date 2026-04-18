import { tokens } from './tokens';

/**
 * Deterministic seven-colour palette for nicknames. Published from the DS
 * (rather than kept as a private const) so the MessageList `colorForName`
 * path and any future mentions / presence-pill palette share the same
 * hashing. Move to tokens.css if this ever needs theme-switching.
 */
export const nickPalette = [
  '#b38b59',
  '#6b8e6b',
  '#8a6f9e',
  '#a86a5c',
  '#5d7d8f',
  '#9a7b3f',
  '#7a6a5c',
] as const;

export const colorForName = (name: string): string => {
  const idx = (name.charCodeAt(0) || 0) % nickPalette.length;
  return nickPalette[idx] ?? '#7a6a5c';
};

interface AvatarProps {
  name?: string;
  size?: number;
}

export const Avatar = ({ name = '?', size = 20 }: AvatarProps) => {
  const ch = name[0]?.toUpperCase() ?? '?';
  const bg = colorForName(name);
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
