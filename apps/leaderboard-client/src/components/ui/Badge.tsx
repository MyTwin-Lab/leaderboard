interface BadgeProps {
  label: string;
  variant?: 'auto' | 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

const autoColors: Record<string, string> = {
  // Challenge / generic statuses
  active: 'bg-green-500/15 text-green-400',
  open: 'bg-green-500/15 text-green-400',
  completed: 'bg-blue-500/15 text-blue-400',
  closed: 'bg-white/10 text-white/50',
  archived: 'bg-white/10 text-white/50',
  cancelled: 'bg-red-500/15 text-red-400',
  draft: 'bg-yellow-500/15 text-yellow-400',
  published: 'bg-green-500/15 text-green-400',
  // Meeting statuses
  scheduled: 'bg-blue-500/15 text-blue-400',
  in_progress: 'bg-yellow-500/15 text-yellow-400',
  analyzed: 'bg-purple-500/15 text-purple-400',
  // Roles
  admin: 'bg-brandCP/15 text-brandCP',
  contributor: 'bg-white/10 text-white/70',
  viewer: 'bg-white/5 text-white/50',
  // Repo / contribution types
  github: 'bg-white/10 text-white/70',
  manual: 'bg-brandCP/10 text-brandCP/80',
  // Category types
  objective: 'bg-blue-500/15 text-blue-400',
  mixed: 'bg-purple-500/15 text-purple-400',
  subjective: 'bg-orange-500/15 text-orange-400',
  contextual: 'bg-green-500/15 text-green-400',
};

const variantStyles: Record<string, string> = {
  default: 'bg-brandCP/10 text-brandCP',
  success: 'bg-green-500/15 text-green-400',
  warning: 'bg-yellow-500/15 text-yellow-400',
  danger: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
  muted: 'bg-white/10 text-white/50',
};

export function Badge({ label, variant = 'auto' }: BadgeProps) {
  const style =
    variant === 'auto'
      ? (autoColors[label?.toLowerCase()] ?? 'bg-white/10 text-white/60')
      : variantStyles[variant];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
