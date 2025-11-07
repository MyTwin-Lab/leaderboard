interface BadgeProps {
  label: string;
}

export function Badge({ label }: BadgeProps) {
  return (
    <span className="rounded-full bg-primary-300/10 px-3 py-1 text-xs font-medium text-primary-200">
      {label}
    </span>
  );
}
