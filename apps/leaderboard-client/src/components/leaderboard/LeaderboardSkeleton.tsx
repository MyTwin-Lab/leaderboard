export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2 rounded-xl bg-white/5 p-6 shadow-md shadow-black/20">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="h-4 w-8 animate-pulse rounded bg-white/10" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 flex-1 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}
