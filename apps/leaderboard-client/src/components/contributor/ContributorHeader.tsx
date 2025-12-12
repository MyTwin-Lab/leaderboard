import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import Image from "next/image";

interface ContributorHeaderProps {
  displayName: string;
  githubUsername: string;
  totalCP: number;
}

export function ContributorHeader({ displayName, githubUsername, totalCP }: ContributorHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-3 sm:block">
        <div className="sm:hidden">
          <InitialsAvatar name={displayName} size={56} />
        </div>
        <div className="hidden sm:block">
          <InitialsAvatar name={displayName} size={72} />
        </div>
        <div className="flex flex-col gap-1 sm:hidden">
          <h1 className="text-lg font-semibold text-white">{displayName}</h1>
          <span className="text-xs text-white/60">@{githubUsername}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <h1 className="text-xl font-semibold text-white">{displayName}</h1>
          <span className="text-xs text-white/60">(@{githubUsername})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white sm:px-3 sm:py-1 sm:text-sm">
            {totalCP} <span className="text-brandCP">CP</span>
          </span>
          <span className="cursor-pointer rounded-full bg-white/10 px-2 py-0.5 sm:py-1">
            <Image className="mt-0.5 sm:mt-1" src="/git.svg" alt="Gitlab" width={13} height={0} priority />
          </span>
          <span className="cursor-pointer rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white sm:py-1 sm:text-sm">
            in
          </span>
        </div>
      </div>
    </div>
  );
}
