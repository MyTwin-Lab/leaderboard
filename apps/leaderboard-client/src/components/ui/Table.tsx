import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
}

export function Table<T extends { uuid?: string; id?: string }>({
  data,
  columns,
  emptyMessage = 'No data available'
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/60 sm:py-12 sm:text-base">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-3 py-2 text-left text-xs font-medium text-white/80 sm:px-4 sm:py-3 sm:text-sm"
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const key = item.uuid || item.id || index;
            return (
              <tr
                key={key}
                className="border-b border-white/5 transition-colors hover:bg-white/5"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 text-xs text-white/90 sm:px-4 sm:py-4 sm:text-sm">
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
