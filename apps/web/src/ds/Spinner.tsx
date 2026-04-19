import { tokens } from './tokens';

type SpinnerSize = 12 | 16 | 20;
type SpinnerTone = 'ink' | 'onScrim';

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  'aria-label'?: string;
}

/**
 * Minimal spinning ring. Integer 2px border for crisp sub-pixel rendering at
 * every target size. The `agora-spin` keyframe is declared once globally in
 * `styles/base.css` – this component only references it.
 */
export const Spinner = ({
  size = 16,
  tone = 'ink',
  'aria-label': ariaLabel = 'Loading',
}: SpinnerProps) => {
  const colour = tone === 'onScrim' ? tokens.color.paper0 : tokens.color.ink1;
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${colour}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'agora-spin 0.8s linear infinite',
      }}
    />
  );
};
