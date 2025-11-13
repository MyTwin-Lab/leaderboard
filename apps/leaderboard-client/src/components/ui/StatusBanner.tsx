interface StatusBannerProps {
  message: string;
  variant?: "info" | "warning" | "error";
}

const variantStyles: Record<Required<StatusBannerProps>["variant"], string> = {
  info: "bg-primary-300/10 text-primary-100",
  warning: "bg-yellow-400/10 text-yellow-300",
  error: "bg-red-500/10 text-red-400",
};

export function StatusBanner({ message, variant = "info" }: StatusBannerProps) {
  return (
    <div className={`rounded-md px-4 py-2 text-sm ${variantStyles[variant]}`}>
      {message}
    </div>
  );
}
