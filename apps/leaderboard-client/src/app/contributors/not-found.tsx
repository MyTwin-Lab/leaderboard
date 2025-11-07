

export default function NotFoundContributor() {
  return (
    <div className="space-y-4 rounded-xl bg-white/5 p-6 text-white">
      <h2 className="text-xl font-semibold">Contributeur introuvable</h2>
      <p className="text-white/60">
        Le profil demandé n'existe pas ou a été supprimé. Vérifiez l'identifiant ou retournez au leaderboard.
      </p>
    </div>
  );
}
