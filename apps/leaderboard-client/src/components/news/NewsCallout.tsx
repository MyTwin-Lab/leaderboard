/**
 * Réservé à l'idée que le lecteur doit emporter s'il ne retient qu'une phrase
 * de la section. Un encadré par section au plus, sinon plus rien ne ressort.
 *
 * La maquette le coiffe d'un « Key takeaway » : c'est ce que l'encadré dit
 * depuis toujours, écrit cette fois. `label` le change pour la mise à jour
 * d'un chapitre précédent (« Update »), en tête de son chapeau.
 */
export function NewsCallout({ label = "Key takeaway", children }: { label?: string; children: React.ReactNode }) {
  return (
    <aside className="v-nd-callout">
      <span className="v-nd-callout-label">{label}</span>
      <div className="v-nd-callout-text">{children}</div>
    </aside>
  );
}
