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
    <div className={`rounded-md bg-white/5 backdrop-blur-sm shadow-md ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
            {count !== undefined && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/50">
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
