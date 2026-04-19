import type { CSSProperties } from 'react';
import { tokens } from './tokens';
import { LockIcon } from './LockIcon';

export type RoomNameSize = 'sm' | 'md';

interface RoomNameProps {
  name: string;
  visibility: 'public' | 'private';
  size?: RoomNameSize;
  className?: string;
  style?: CSSProperties;
}

const sizeMap: Record<RoomNameSize, { fontSize: number; lockSize: number }> = {
  sm: { fontSize: 13, lockSize: 11 },
  md: { fontSize: 14, lockSize: 12 },
};

/**
 * Canonical presentation of a room identity: `#name` in mono, with a
 * padlock glyph prefixed when the room is private. Replaces the ad-hoc
 * `<Badge tone="private">private</Badge>` and inline padlock SVGs that
 * had been copy-pasted across the chat view, dossier, sidebar, and the
 * invitations list.
 */
export const RoomName = ({
  name,
  visibility,
  size = 'md',
  className,
  style,
}: RoomNameProps) => {
  const { fontSize, lockSize } = sizeMap[size];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: tokens.type.mono,
        fontSize,
        color: tokens.color.ink0,
        ...style,
      }}
    >
      {visibility === 'private' ? (
        <span
          aria-label="private room"
          style={{ color: tokens.color.ink2, display: 'inline-flex' }}
        >
          <LockIcon size={lockSize} />
        </span>
      ) : null}
      <span>#{name}</span>
    </span>
  );
};
