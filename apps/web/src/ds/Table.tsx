import type { ReactNode } from 'react';
import { tokens } from './tokens';

interface TableProps {
  cols: string[];
  rows: ReactNode[][];
  /** Row index to paint with the accent-soft highlight. Used for "current
   *  session" on the sessions page (audit C-03). */
  highlightRowAt?: number;
  caption?: string;
}

export const Table = ({ cols, rows, highlightRowAt, caption }: TableProps) => (
  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: tokens.type.sans,
      fontSize: 12,
    }}
  >
    {caption ? (
      <caption
        style={{
          captionSide: 'top',
          textAlign: 'left',
          padding: '0 0 6px',
          fontFamily: tokens.type.sans,
          fontSize: 12,
          color: tokens.color.ink2,
        }}
      >
        {caption}
      </caption>
    ) : null}
    <thead>
      <tr>
        {cols.map((col, colIndex) => (
          <th
            key={`${col}-${colIndex}`}
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
        <tr
          key={rowIndex}
          style={{
            borderBottom: `1px solid ${tokens.color.paper2}`,
            background: rowIndex === highlightRowAt ? tokens.color.accentSoft : undefined,
          }}
        >
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
