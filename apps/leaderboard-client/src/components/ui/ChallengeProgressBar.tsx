interface ProgressBarProps {
  value: number; // 0-1
}

export function ChallengeProgressBar({ value }: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(1, value));

  return (
    <div className="h-1 w-full rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-brandCP transition-[width] duration-300"
        style={{ width: `${percentage * 100}%` }}
      />
    </div>
  );
}
