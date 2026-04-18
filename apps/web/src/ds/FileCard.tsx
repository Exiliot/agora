import { tokens } from './tokens';

interface FileCardProps {
  name: string;
  size: string;
  kind?: string;
  comment?: string;
  image?: boolean;
  href?: string;
}

export const FileCard = ({ name, size, kind = 'file', comment, image, href }: FileCardProps) => {
  if (image) {
    return (
      <a
        href={href}
        style={{
          display: 'inline-block',
          margin: '4px 0',
          border: `1px solid ${tokens.color.rule}`,
          background: '#fff',
          padding: 4,
          maxWidth: 280,
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            height: 140,
            background: `repeating-linear-gradient(45deg, ${tokens.color.paper2} 0 8px, ${tokens.color.paper1} 8px 16px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: tokens.type.mono,
            fontSize: 11,
            color: tokens.color.ink2,
          }}
        >
          [image preview]
        </div>
        <div
          style={{
            padding: '4px 2px 0',
            fontFamily: tokens.type.mono,
            fontSize: 11,
            color: tokens.color.ink2,
          }}
        >
          {name} · {size}
        </div>
      </a>
    );
  }

  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        margin: '4px 0',
        border: `1px solid ${tokens.color.rule}`,
        background: '#fff',
        maxWidth: 360,
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 40,
          background: tokens.color.paper2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: tokens.type.mono,
          fontSize: 10,
          fontWeight: 600,
          color: tokens.color.ink1,
          borderRight: `1px solid ${tokens.color.rule}`,
          letterSpacing: 0.5,
        }}
      >
        {kind.toUpperCase().slice(0, 4)}
      </div>
      <div
        style={{
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: tokens.type.mono,
            fontSize: 12,
            color: tokens.color.accent,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 11, color: tokens.color.ink2 }}>
          {size}
          {comment ? ` — ${comment}` : ''}
        </div>
      </div>
    </a>
  );
};
