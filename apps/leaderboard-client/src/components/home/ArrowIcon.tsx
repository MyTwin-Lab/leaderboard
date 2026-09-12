/**
 * La flèche des liens « voir tout » de la page d'accueil.
 *
 * Extraite parce qu'elle était déjà dupliquée entre `HomeChallengesPreview` et
 * `HomeLeaderboardPreview`, et que le lien « About the Lab » du hero en aurait
 * fait une troisième copie. `currentColor` : c'est le lien qui décide de la
 * teinte, la flèche ne fait que suivre.
 */
export const ArrowIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg
    className={className}
    style={{ color: "inherit" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
      clipRule="evenodd"
    />
  </svg>
);
