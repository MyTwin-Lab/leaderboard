import type { ComponentType } from 'react';
import { githubEventsOf } from '../../../../content/connectors/github/activity';
import { kaggleDatasetOf, kaggleModelOf } from '../../../../content/connectors/kaggle/activity';
import { GithubActivityFeed } from './activity/github';

/**
 * Distribution MyTwin — activité des dépôts, côté client
 * ------------------------------------------------------
 * Le shell ne connaît de l'activité que l'enveloppe `{ connectorKey, payload }`
 * servie par `/api/challenges/[id]/repo-activity`. Ce manifeste dit comment la
 * lire : les rendus par connecteur et les extracteurs typés dont les flows ont
 * besoin (les métriques Kaggle pour le flow ML).
 */

export type RepoActivities = Record<string, unknown> | null;

export { githubEventsOf, kaggleDatasetOf, kaggleModelOf };

/** Les flux d'activité des connecteurs installés, dans l'ordre d'affichage. */
const activityRenderers: ComponentType<{ activities: RepoActivities }>[] = [GithubActivityFeed];

/** L'activité des dépôts d'un challenge ; `null` pendant le chargement. */
export function RepoActivityFeed({ activities }: { activities: RepoActivities }) {
  return (
    <>
      {activityRenderers.map((Feed, i) => (
        <Feed key={i} activities={activities} />
      ))}
    </>
  );
}
