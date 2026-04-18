import type { InputHTMLAttributes } from 'react';
import { tokens } from './tokens';

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  radio?: boolean;
}

export const Check = ({ label, radio = false, ...rest }: CheckProps) => (
  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: tokens.color.ink0,
      cursor: 'pointer',
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
