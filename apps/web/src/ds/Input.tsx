import { useId, type CSSProperties, type InputHTMLAttributes } from 'react';
import { Col } from './Layout';
import { tokens } from './tokens';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: boolean;
  inputStyle?: CSSProperties;
  containerStyle?: CSSProperties;
}

export const Input = ({
  label,
  hint,
  error = false,
  type = 'text',
  containerStyle,
  inputStyle,
  id,
  ...rest
}: InputProps) => {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <Col gap={4} style={{ width: '100%', ...containerStyle }}>
      {label ? (
        <label
          htmlFor={fieldId}
          style={{ fontSize: 12, color: tokens.color.ink1, fontWeight: 500 }}
        >
          {label}
        </label>
      ) : null}
      <input
        id={fieldId}
        type={type}
        style={{
          fontFamily: tokens.type.sans,
          fontSize: 13,
          padding: '8px 10px',
          background: '#fff',
          border: `1px solid ${error ? tokens.color.danger : tokens.color.rule}`,
          borderTop: `1px solid ${error ? tokens.color.danger : tokens.color.ruleStrong}`,
          borderRadius: tokens.radius.xs,
          color: tokens.color.ink0,
          outline: 'none',
          boxShadow: 'inset 0 1px 0 rgba(0,0,0,.04)',
          ...inputStyle,
        }}
        {...rest}
      />
      {hint ? (
        <div style={{ fontSize: 11, color: error ? tokens.color.danger : tokens.color.ink2 }}>
          {hint}
        </div>
      ) : null}
    </Col>
  );
};
