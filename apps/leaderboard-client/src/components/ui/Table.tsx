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
      <div className="text-center py-12 text-white/60">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-sm font-medium text-white/80"
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
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4 text-sm text-white/90">
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
