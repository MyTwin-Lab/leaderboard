import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/types";

const MAX_DISPLAY = 5;

// boxShadow ring that uses the page background colour as separator so
// overlapping avatars look cleanly separated without a visible border.
const RING = '0 0 0 2px var(--background)';
// Soft, wide-spread drop shadow for the "floating" variant — makes each
// avatar lift off the card, closer to the navbar's ContributorBadge look.
const FLOATING_SHADOW = '0 20px 45px -8px rgba(0,0,0,0.45)';

interface TeamAvatarsProps {
  members: TeamMember[];
  maxDisplay?: number;
  /**
   * 'default' (everywhere) keeps the flat theme-coloured circle with just the
   * separator ring. 'floating' (challenge list card only, for now) swaps the
   * background for a translucent white, softens the radius, and adds the
   * wide drop shadow — everyone else is untouched.
   */
  variant?: 'default' | 'floating';
}

export function TeamAvatars({ members, maxDisplay = MAX_DISPLAY, variant = 'default' }: TeamAvatarsProps) {
  const displayedMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;
  const floating = variant === 'floating';
  // rounded-2xl (16px) on a 32px box is a half-radius = a perfect circle
  // again — same trap as rounded-full. rounded-xl (12px) actually reads as a
  // rounded square at this size, matching the navbar avatar's proportions
  // (16px radius on its 40px box, ~40%) rather than its literal class name.
  const radius = floating ? 'rounded-xl' : 'rounded-full';
  const boxShadow = floating ? `${RING}, ${FLOATING_SHADOW}` : RING;

  if (members.length === 0) {
    return <span className="text-xs text-white/40">Waiting for you...</span>;
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-4">
        {displayedMembers.map((member, index) => (
          <div
            key={member.id}
            className={cn(radius, "overflow-hidden")}
            style={{
              zIndex: maxDisplay - index,
              // solid background so the next avatar doesn't bleed through
              background: 'var(--background-dark)',
              boxShadow,
            }}
            title={member.fullName}
          >
            <InitialsAvatar
              name={member.fullName}
              size={32}
              avatarUrl={member.avatarUrl}
              className={floating ? "rounded-xl bg-white/10" : undefined}
            />
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold", radius)}
            style={{
              zIndex: 0,
              background: 'var(--background-dark)',
              color: 'var(--foreground)',
              opacity: 0.7,
              boxShadow,
            }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}
