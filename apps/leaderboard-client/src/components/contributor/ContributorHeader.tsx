import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import Image from "next/image";

interface ContributorHeaderProps {
  displayName: string;
  githubUsername: string;
  totalCP: number;
}

export function ContributorHeader({ displayName, githubUsername, totalCP }: ContributorHeaderProps) {
  return (
    <div className="flex flex-col gap-4 px-6 mb-10 sm:flex-row sm:items-center">
      <InitialsAvatar name={displayName} size={72} />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap gap-2 items-center">
          <h1 className="text-xl font-semibold text-white">{displayName}</h1>
          <span className="text-white/60 text-xs">(@{githubUsername})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
            {totalCP} <span className="text-brandCP">CP</span>
          </span>
          <span className="cursor-pointer rounded-full bg-white/10 px-2 py-1">
            <Image className="mt-1" src="/git.svg" alt="Gitlab" width={13} height={0} priority />
          </span>
          <span className="cursor-pointer rounded-full bg-white/10 px-2 py-1 text-sm font-semibold text-white">
            in
          </span>
        </div>
      </div>
    </div>
  );
}
