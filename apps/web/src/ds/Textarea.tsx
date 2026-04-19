import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { tokens } from './tokens';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/**
 * Sibling to `Input`: same boxed frame (white fill, 1px rule, rule-strong top
 * border, inset highlight). Intentionally dumb – any autoresize, mention
 * parsing, etc. is the consumer's job.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, style, rows = 3, ...rest }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      style={{
        width: '100%',
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
        resize: 'vertical',
        ...style,
      }}
      {...rest}
    />
  ),
);

Textarea.displayName = 'Textarea';
