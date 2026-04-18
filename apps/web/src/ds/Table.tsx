import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface TableProps {
  cols: string[];
  rows: ReactNode[][];
}

export const Table = ({ cols, rows }: TableProps) => (
  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: tokens.type.sans,
      fontSize: 12,
    }}
  >
    <thead>
      <tr>
        {cols.map((col) => (
          <th
            key={col}
            style={{
              textAlign: 'left',
              padding: '6px 10px',
              fontWeight: 600,
              color: tokens.color.ink2,
              fontFamily: tokens.type.mono,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              borderBottom: `1px solid ${tokens.color.rule}`,
              background: tokens.color.paper1,
            }}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, rowIndex) => (
        <tr key={rowIndex} style={{ borderBottom: `1px solid ${tokens.color.paper2}` }}>
          {row.map((cell, cellIndex) => (
            <td
              key={cellIndex}
              style={{ padding: '6px 10px', color: tokens.color.ink0, verticalAlign: 'middle' }}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
