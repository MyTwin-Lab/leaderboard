export default function NotFoundContributor() {
  return (
    <div className="mx-auto mt-8 max-w-lg space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight">Contributeur introuvable</h2>
      <p className="text-sm leading-relaxed text-white/60">
        Le profil demandé n&apos;existe pas ou a été supprimé. Vérifiez l&apos;identifiant ou retournez au leaderboard.
      </p>
    </div>
  );
}
