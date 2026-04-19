/**
 * JS mirror of the CSS tokens in `src/styles/tokens.css`. Use for inline
 * styles where a CSS class would be cumbersome. Never invent values here –
 * add them in tokens.css first and mirror.
 */

export const tokens = {
  color: {
    paper0: 'var(--paper-0)',
    paper1: 'var(--paper-1)',
    paper2: 'var(--paper-2)',
    paper3: 'var(--paper-3)',
    paperOnScrim: 'var(--paper-on-scrim)',
    rule: 'var(--rule)',
    ruleStrong: 'var(--rule-strong)',
    ink0: 'var(--ink-0)',
    ink1: 'var(--ink-1)',
    ink2: 'var(--ink-2)',
    ink3: 'var(--ink-3)',
    accent: 'var(--accent)',
    accentSoft: 'var(--accent-soft)',
    accentInk: 'var(--accent-ink)',
    online: 'var(--online)',
    afk: 'var(--afk)',
    offline: 'var(--offline)',
    danger: 'var(--danger)',
    dangerSoft: 'var(--danger-soft)',
    mentionBg: 'var(--mention-bg)',
    mentionFg: 'var(--mention-fg)',
    mentionWash: 'var(--mention-wash)',
    chromeUp: 'var(--chrome-up)',
    chromeDown: 'var(--chrome-down)',
    scrim: 'var(--scrim)',
  },
  radius: { xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)' },
  gradient: { chrome: 'var(--grad-chrome)' },
  type: { sans: 'var(--sans)', mono: 'var(--mono)', serif: 'var(--serif)' },
} as const;
