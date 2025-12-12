interface BadgeProps {
  label: string;
}

export function Badge({ label }: BadgeProps) {
  return (
    <span className="rounded-full bg-brandCP/10 px-3 py-1 text-xs font-medium text-brandCP">
      {label}
    </span>
  );
}
