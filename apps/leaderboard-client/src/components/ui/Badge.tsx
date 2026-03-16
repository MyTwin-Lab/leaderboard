interface BadgeProps {
  label: string;
  variant?: 'default' | 'success';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-brandCP/10 text-brandCP',
    success: 'bg-green-500/10 text-green-400',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${variantStyles[variant]}`}>
      {label}
    </span>
  );
}
