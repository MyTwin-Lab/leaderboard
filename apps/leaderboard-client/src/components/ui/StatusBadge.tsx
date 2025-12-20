interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  succeeded: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  canceled: 'bg-white/10 text-white/50 border-white/20',
  identified: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  merged: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  evaluated: 'bg-green-500/10 text-green-400 border-green-500/20',
  skipped: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-white/10 text-white/70 border-white/20';
  
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
