export type ScenarioResult = 'passed' | 'failed' | 'blocked';

/** Les trois résultats d'étape, dans l'ordre où le validateur les voit. */
export const SCENARIO_RESULTS: ScenarioResult[] = ['passed', 'failed', 'blocked'];

/**
 * Le vocabulaire visuel des résultats, en tokens de l'app — pas en hex du
 * maquettage. `mark` est la lettre unique de la vue de supervision, où une
 * walkthrough se lit d'un coup d'oeil comme une ligne `PPFPBPP`.
 *
 * Vert/rouge sont ceux que le flux ML utilise déjà pour works/broken ; ambre
 * dit « bloqué », c'est-à-dire ni réussi ni raté mais impossible à tenter —
 * l'application s'est arrêtée, ou l'étape précédente l'a rendue inatteignable.
 *
 * `strong` porte le remplissage appuyé pour la barre de progression de la
 * tâche 15 : Tailwind n'émet que les classes visibles littéralement dans le
 * source, donc un `meta.bg.replace('/15','/60')` construit à l'exécution ne
 * générerait jamais la classe. Ce panneau n'utilise pas `strong` lui-même.
 */
export const RESULT_META: Record<ScenarioResult, {
  label: string; mark: string; text: string; bg: string; strong: string; border: string;
}> = {
  passed:  { label: 'Passed',  mark: 'P', text: 'text-green-400', bg: 'bg-green-500/15', strong: 'bg-green-500/60', border: 'border-green-500/30' },
  failed:  { label: 'Failed',  mark: 'F', text: 'text-red-400',   bg: 'bg-red-500/15',   strong: 'bg-red-500/60',   border: 'border-red-500/30' },
  blocked: { label: 'Blocked', mark: 'B', text: 'text-amber-400', bg: 'bg-amber-500/15', strong: 'bg-amber-500/60', border: 'border-amber-500/30' },
};
