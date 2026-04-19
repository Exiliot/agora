import { useId, useState, type CSSProperties, type InputHTMLAttributes } from 'react';
import { Col } from './Layout';
import { tokens } from './tokens';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /**
   * Colours the border in danger. Kept separate from `errorMessage` so a form
   * can still highlight a field after the accompanying Toast has been
   * dismissed, or when the page-level error is not specific to one field.
   */
  error?: boolean;
  /**
   * When set, renders an inline `role="alert"` under the input with this
   * message, and wires `aria-invalid` + `aria-describedby` on the `<input>`.
   * See ADR-0011.
   */
  errorMessage?: string;
  inputStyle?: CSSProperties;
  containerStyle?: CSSProperties;
  /** Show a "show/hide" toggle on the right edge. Only applies when
   *  `type="password"`. Text button, not an icon – stays consistent with the
   *  rest of the DS (no emoji, mono labels). */
  reveal?: boolean;
}

export const Input = ({
  label,
  hint,
  error = false,
  errorMessage,
  type = 'text',
  containerStyle,
  inputStyle,
  id,
  reveal = false,
  ...rest
}: InputProps) => {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = useId();
  const hintId = useId();
  const [shown, setShown] = useState(false);

  const isPassword = type === 'password';
  const effectiveType = isPassword && shown ? 'text' : type;
  const showToggle = isPassword && reveal;
  const hasErrorMessage = Boolean(errorMessage);
  const effectiveError = error || hasErrorMessage;

  const describedBy =
    [hasErrorMessage ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const inputEl = (
    <input
      id={fieldId}
      type={effectiveType}
      aria-invalid={effectiveError || undefined}
      aria-describedby={describedBy}
      style={{
        width: '100%',
        fontFamily: tokens.type.sans,
        fontSize: 13,
        padding: showToggle ? '8px 52px 8px 10px' : '8px 10px',
        background: '#fff',
        border: `1px solid ${effectiveError ? tokens.color.danger : tokens.color.rule}`,
        borderTop: `1px solid ${effectiveError ? tokens.color.danger : tokens.color.ruleStrong}`,
        borderRadius: tokens.radius.xs,
        color: tokens.color.ink0,
        outline: 'none',
        boxShadow: 'inset 0 1px 0 rgba(0,0,0,.04)',
        ...inputStyle,
      }}
      {...rest}
    />
  );

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
      {showToggle ? (
        <div style={{ position: 'relative', width: '100%' }}>
          {inputEl}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              padding: '0 10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: tokens.type.mono,
              fontSize: 11,
              letterSpacing: 0.4,
              color: tokens.color.ink2,
            }}
          >
            {shown ? 'hide' : 'show'}
          </button>
        </div>
      ) : (
        inputEl
      )}
      {hasErrorMessage ? (
        <div
          id={errorId}
          role="alert"
          style={{ fontSize: 11, color: tokens.color.danger }}
        >
          {errorMessage}
        </div>
      ) : null}
      {hint ? (
        <div
          id={hintId}
          style={{ fontSize: 11, color: effectiveError ? tokens.color.danger : tokens.color.ink2 }}
        >
          {hint}
        </div>
      ) : null}
    </Col>
  );
};
