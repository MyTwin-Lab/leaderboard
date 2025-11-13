import { InitialsAvatar } from "@/components/ui/InitialsAvatar";

interface ContributorHeaderProps {
  displayName: string;
  githubUsername: string;
  totalCP: number;
}

export function ContributorHeader({ displayName, githubUsername, totalCP }: ContributorHeaderProps) {
  return (
    <div className="flex flex-col gap-4 px-6 mb-10 sm:flex-row sm:items-center">
      <InitialsAvatar name={displayName} size={64} />
      <div className="flex flex-1 flex-col gap-1">
        <h1 className="text-xl font-semibold text-white">{displayName}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
            {totalCP} <span className="text-brandCP">CP</span>
          </span>
          <span className="text-white/60">@{githubUsername}</span>
        </div>
      </div>
    </div>
  );
}
