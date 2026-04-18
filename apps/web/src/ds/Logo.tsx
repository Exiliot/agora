import { tokens } from './tokens';

interface LogoProps {
  size?: number;
}

export const Logo = ({ size = 22 }: LogoProps) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <span
      style={{
        width: size,
        height: size,
        background: tokens.color.ink0,
        color: tokens.color.paper0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: tokens.type.serif,
        fontWeight: 600,
        fontSize: Math.round(size * 0.75),
        borderRadius: tokens.radius.xs,
        fontStyle: 'italic',
      }}
    >
      a
    </span>
    <span
      style={{
        fontFamily: tokens.type.serif,
        fontSize: size * 0.85,
        fontWeight: 500,
        letterSpacing: 0.5,
        color: tokens.color.ink0,
      }}
    >
      agora
    </span>
  </span>
);
