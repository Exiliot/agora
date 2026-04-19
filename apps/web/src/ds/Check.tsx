import type { InputHTMLAttributes } from 'react';
import { tokens } from './tokens';

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  radio?: boolean;
}

/**
 * The `ds-check-label` class picks up the `:focus-within` ring in base.css
 * – the native 13×13 control itself is too small for a readable 2px outline
 * with 2px offset, so the ring is painted on the wrapping label instead.
 */
export const Check = ({ label, radio = false, ...rest }: CheckProps) => (
  <label
    className="ds-check-label"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: tokens.color.ink0,
      cursor: 'pointer',
      padding: '2px 4px',
      marginLeft: -4,
      borderRadius: tokens.radius.xs,
    }}
  >
    <input
      type={radio ? 'radio' : 'checkbox'}
      style={{ accentColor: tokens.color.accent, margin: 0, width: 13, height: 13 }}
      {...rest}
    />
    {label}
  </label>
);
