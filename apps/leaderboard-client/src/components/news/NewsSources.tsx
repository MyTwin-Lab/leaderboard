import { formatIndex } from "@/content/news/format";
import type { NewsSource } from "@/content/news/types";

export const NEWS_DISCLAIMER =
  "This news is provided for information only. The technologies it describes are at research or pilot stage, and none of them replaces advice, diagnosis or treatment from a healthcare professional.";

/**
 * Les sources, numérotées comme le sommaire : sur un sujet de santé, pouvoir
 * vérifier d'où vient une affirmation fait partie du contenu lui-même.
 *
 * Un seul balisage pour les deux mises en page de la maquette. Sur écran, le
 * `<h2>` coiffe la liste ; sous 768px il s'efface et le résumé du `<details>`
 * prend sa place, « Sources · n ». Le `<details>` est ouvert au chargement :
 * c'est la seule liberté prise sur la maquette téléphone, et elle évite qu'un
 * script décide de ce qui est lisible.
 */
export function NewsSources({ id, sources }: { id: string; sources: NewsSource[] }) {
  return (
    <section aria-labelledby={id} className="v-nd-sources">
      <h2 id={id} className="v-nd-sources-title">
        Sources
      </h2>

      <details open className="v-nd-sources-fold">
        <summary className="v-nd-sources-summary">
          Sources · {sources.length}
          <span aria-hidden className="v-nd-plus">
            +
          </span>
        </summary>

        <ol className="v-nd-sources-list">
          {sources.map((source, index) => (
            <li key={source.url} className="v-nd-source">
              <span className="v-nd-source-num">{formatIndex(index)}</span>
              <a href={source.url} target="_blank" rel="noopener">
                {source.label}
              </a>
            </li>
          ))}
        </ol>
      </details>

      <p className="v-nd-disclaimer">{NEWS_DISCLAIMER}</p>
    </section>
  );
}
