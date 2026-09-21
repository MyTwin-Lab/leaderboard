/**
 * Instantané du top 3 de `/leaderboard`, écrit à la main pour montrer les
 * photos de `public/landing/contributors/`, que les comptes n'ont pas. La
 * landing et l'illustration de la news du Leaderboard le lisent tous les deux.
 * À rebrancher sur `fetchLeaderboard()` quand les avatars suivront.
 */
export const TOP_CONTRIBUTORS_SNAPSHOT = [
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
