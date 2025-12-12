import type { TeamMember } from "@/lib/types";

interface TeamAvatarsProps {
  members: TeamMember[];
  maxDisplay?: number;
}

export function TeamAvatars({ members, maxDisplay = 4 }: TeamAvatarsProps) {
  const displayedMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;

  if (members.length === 0) {
    return <span className="text-xs text-white/40">No team yet</span>;
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-3">
        {displayedMembers.map((member, index) => (
          <div
            key={member.id}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brandCP text-xs font-semibold text-slate-900 ring-1 ring-slate-900"
            style={{ zIndex: maxDisplay - index }}
            title={member.fullName}
          >
            {member.fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white ring-2 ring-slate-900"
            style={{ zIndex: 0 }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}
