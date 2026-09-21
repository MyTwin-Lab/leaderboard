import Image from "next/image";
import { formatCP } from "@/lib/formatters";

/**
 * Instantané du top 3 de `/leaderboard`, écrit à la main pour montrer les
 * photos de `public/landing/contributors/`, que les comptes n'ont pas. À
 * rebrancher sur le classement quand les avatars suivront.
 */
const TOP_CONTRIBUTORS_SNAPSHOT = [
  { rank: 1, name: "Alix Chagot", bio: "Software Engineer", cp: 23641, photo: "/landing/contributors/alix_chagot.webp" },
  { rank: 2, name: "Antoine", bio: "Software Engineer", cp: 7600, photo: "/landing/contributors/antoine_tessier.webp" },
  {
    rank: 3,
    name: "Mahdi Lamriben",
    bio: "Fullstack, Data & AI Engineer",
    cp: 6000,
    photo: "/landing/contributors/mahdi_lamriben.webp",
  },
] as const;

// Le top 3 dessiné pour le cadre des aperçus : des tailles en `em` qui suivent
// la largeur du cadre, et des couleurs fixes, le panneau restant clair quel que
// soit le thème du Lab.
export function TopContributorsIllustration() {
  return (
    <div className="flex w-[88%] max-w-[24em] flex-col gap-[0.85em]">
      <div className="flex flex-col gap-[0.3em]">
        <p className="flex items-center gap-[0.6em] text-[0.68em] font-medium uppercase tracking-[0.14em] text-[#586067]">
          <span className="relative flex size-[0.5em]">
            <span className="absolute inset-0 rounded-full bg-[#0b7a64] opacity-60 motion-safe:animate-ping" />
            <span className="relative size-full rounded-full bg-[#0b7a64]" />
          </span>
          Live ranking
        </p>
        <p className="text-[1.15em] font-bold leading-tight tracking-tight">Top 3 contributors</p>
      </div>

      <ol className="divide-y divide-black/10 overflow-hidden rounded-[0.9em] border border-black/10 bg-white shadow-[0_1.5em_3em_-1.75em_rgb(17_22_26/0.28)]">
        {TOP_CONTRIBUTORS_SNAPSHOT.map((contributor) => (
          <li
            key={contributor.name}
            className="grid grid-cols-[0.9em_2.3em_minmax(0,1fr)_auto] items-center gap-[0.7em] px-[0.95em] py-[0.55em] first:bg-[linear-gradient(90deg,rgb(11_122_100/0.07),transparent_70%)]"
          >
            <span
              className={`text-[0.75em] font-medium tabular-nums ${contributor.rank === 1 ? "text-[#0b7a64]" : "text-[#8b9196]"}`}
            >
              {contributor.rank}
            </span>
            <Image
              src={contributor.photo}
              alt=""
              width={80}
              height={80}
              className="size-[2.3em] rounded-full object-cover"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.88em] font-medium leading-snug">{contributor.name}</span>
              <span className="truncate text-[0.72em] leading-snug text-[#586067]">{contributor.bio}</span>
            </span>
            <span className="flex items-baseline gap-[0.25em] whitespace-nowrap text-[0.95em] font-bold tabular-nums tracking-tight">
              {formatCP(contributor.cp)}
              <small className="text-[0.62em] tracking-wide text-[#0b7a64]">CP</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
