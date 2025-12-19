import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}

export function Card({ children, className = '', title, action }: CardProps) {
  return (
    <div className={`rounded-md bg-white/5 backdrop-blur-sm shadow-md ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="px-3">
        {children}
      </div>
    </div>
  );
}
