import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import type { TeamMember } from "@/lib/types";

const MAX_DISPLAY = 5;
const DEFAULT_SIZE = 32;

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
  /**
   * Tile size in px. The overlap follows it (always half a tile), so callers
   * only pick one number. The challenge hero's Team stat card passes a smaller
   * size: its grid row stretches to the tallest card, and at the default size
   * the avatars made that card outgrow the two next to it.
   */
  size?: number;
}

export function TeamAvatars({
  members,
  maxDisplay = MAX_DISPLAY,
  variant = 'default',
  size = DEFAULT_SIZE,
}: TeamAvatarsProps) {
  const displayedMembers = members.slice(0, maxDisplay);
  const remainingCount = members.length - maxDisplay;
  const floating = variant === 'floating';
  // Squircle, not a circle — matches the mockup (11px radius on a 30px tile)
  // and the leaderboard's own avatars (rounded-xl/rounded-2xl), not a full
  // rounded-full circle. The ratio has to follow the tile size: a fixed 12px
  // radius on a 26px tile is nearly half the side, which reads as an oval
  // rather than a squircle.
  const radius = Math.round(size * 0.37);
  // The wrapper clips (overflow-hidden), so the avatar inside keeps square
  // corners — otherwise its own larger radius would show the wrapper's
  // background bleeding through at each corner.
  const innerRadius = 'rounded-none';
  const boxShadow = floating ? `${RING}, ${FLOATING_SHADOW}` : undefined;
  // Half-tile overlap, same ratio the old fixed -space-x-4 gave at 32px.
  const overlap = -Math.round(size / 2);

  if (members.length === 0) {
    return <span className="text-xs text-white/40">Waiting for you...</span>;
  }

  return (
    <div className="flex items-center">
      <div className="flex">
        {displayedMembers.map((member, index) => (
          <div
            key={member.id}
            className="overflow-hidden"
            style={{
              zIndex: maxDisplay - index,
              background: 'var(--background)',
              boxShadow,
              borderRadius: radius,
              marginLeft: index === 0 ? undefined : overlap,
            }}
            title={member.fullName}
          >
            <InitialsAvatar
              name={member.fullName}
              size={size}
              avatarUrl={member.avatarUrl}
              className={floating ? `${innerRadius} bg-white/10` : innerRadius}
            />
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className="flex shrink-0 items-center justify-center text-xs font-semibold"
            style={{
              zIndex: 0,
              height: size,
              width: size,
              borderRadius: radius,
              background: 'var(--background-dark)',
              color: 'var(--foreground)',
              opacity: 0.7,
              boxShadow,
              marginLeft: displayedMembers.length === 0 ? undefined : overlap,
            }}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}
