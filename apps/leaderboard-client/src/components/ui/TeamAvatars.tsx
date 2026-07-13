import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import type { TeamMember } from "@/lib/types";

const MAX_DISPLAY = 5;

// boxShadow ring that uses the page background colour as separator
// so overlapping circles look cleanly separated without a visible border
const ringStyle = { boxShadow: '0 0 0 2px var(--background)' };

interface TeamAvatarsProps {
  members: TeamMember[];
  maxDisplay?: number;
}

export function TeamAvatars({ members, maxDisplay = MAX_DISPLAY }: TeamAvatarsProps) {
  const displayedMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;

  if (members.length === 0) {
    return <span className="text-xs text-white/40">Waiting for you...</span>;
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-4">
        {displayedMembers.map((member, index) => (
          <div
            key={member.id}
            className="rounded-full overflow-hidden"
            style={{
              zIndex: maxDisplay - index,
              // solid background so the next avatar doesn't bleed through
              background: 'var(--background-dark)',
              ...ringStyle,
            }}
            title={member.fullName}
          >
            <InitialsAvatar name={member.fullName} size={32} avatarUrl={member.avatarUrl} />
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{
              zIndex: 0,
              background: 'var(--background-dark)',
              color: 'var(--foreground)',
              opacity: 0.7,
              ...ringStyle,
            }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}
