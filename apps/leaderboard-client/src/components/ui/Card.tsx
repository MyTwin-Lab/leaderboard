import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  count?: number;
  action?: ReactNode;
}

export function Card({ children, className = '', title, count, action }: CardProps) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-md shadow-black/20 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {count !== undefined && (
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/40">
                {count}
              </span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="px-3">
        {children}
      </div>
    </div>
  );
}
