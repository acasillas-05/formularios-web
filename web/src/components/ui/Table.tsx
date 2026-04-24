import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { EmptyState } from './EmptyState';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
};

type TableProps<T> = {
  columns: Column<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Cuantas filas de shimmer mostrar durante loading. */
  skeletonRows?: number;
};

export function Table<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isLoading,
  emptyTitle = 'Sin resultados',
  emptyDescription,
  skeletonRows = 5,
}: TableProps<T>) {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-bg-surface sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    !c.align && 'text-left',
                    c.className,
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={`s${i}`} className="border-b border-border/50">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <div className="h-4 rounded bg-bg-surface animate-shimmer" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-border/50 transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-bg-surface/50' : '',
                    )}
                  >
                    {columns.map((c) => {
                      const rendered = c.render ? c.render(row) : ((row as unknown as Record<string, unknown>)[c.key] as ReactNode);
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            'px-4 py-3 text-sm text-text',
                            c.align === 'right' && 'text-right',
                            c.align === 'center' && 'text-center',
                            c.className,
                          )}
                        >
                          {rendered ?? <span className="text-muted/60">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
      ) : null}
    </div>
  );
}
