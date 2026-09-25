/**
 * Réservé à l'idée que le lecteur doit emporter s'il ne retient qu'une phrase
 * de la section. Un encadré par section au plus, sinon plus rien ne ressort.
 *
 * La maquette le coiffe d'un « Key takeaway » : c'est ce que l'encadré dit
 * depuis toujours, écrit cette fois.
 */
export function NewsCallout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="v-nd-callout">
      <span className="v-nd-callout-label">Key takeaway</span>
      <div className="v-nd-callout-text">{children}</div>
    </aside>
  );
}
