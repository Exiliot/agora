interface LockIconProps {
  size?: number;
}

/**
 * Shared padlock glyph used to flag private rooms in the slim header, the
 * dossier aside, the sidebar list, and the invitations list. Single source
 * of truth so the shape doesn't drift between call sites.
 */
export const LockIcon = ({ size = 12 }: LockIconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.25" y="5.25" width="7.5" height="5.25" rx="1" />
    <path d="M4 5.25V3.5a2 2 0 0 1 4 0v1.75" />
  </svg>
);
