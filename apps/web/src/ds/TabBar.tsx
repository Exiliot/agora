import { tokens } from './tokens';

interface TabBarProps {
  items: string[];
  active: number;
  onSelect?: (index: number) => void;
}

export const TabBar = ({ items, active, onSelect }: TabBarProps) => (
  <div style={{ display: 'flex', borderBottom: `1px solid ${tokens.color.rule}` }}>
    {items.map((label, index) => (
      <button
        key={label}
        type="button"
        onClick={onSelect ? () => onSelect(index) : undefined}
        style={{
          background: 'transparent',
          padding: '8px 14px',
          fontFamily: tokens.type.sans,
          fontSize: 12,
          fontWeight: 500,
          color: index === active ? tokens.color.ink0 : tokens.color.ink2,
          borderBottom: index === active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
          border: 'none',
          marginBottom: -1,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    ))}
  </div>
);
