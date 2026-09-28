import { Check, X } from "lucide-react";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { PlatformRegistry } from "@packages/registry/platform";
import type { OnboardingProgressWithUser } from "@packages/database-service/domain/entities";

interface Props {
  rows: OnboardingProgressWithUser[];
  /** Les colonnes : les quêtes installées, dans leur ordre, par défaut. */
  quests?: { key: string; label: string }[];
}

/**
 * La table d'avancement de l'onboarding, à la matière de
 * `Profile Vitrine.dc.html` : une carte blanche, un en-tête gris, un filet par
 * ligne.
 *
 * La maquette montre trois colonnes de dates ; ici ce sont les quêtes
 * installées, cochées ou non — c'est ce que la base porte.
 */
function installedQuests(): { key: string; label: string }[] {
  if (!PlatformRegistry.isInstalled()) return [];
  return PlatformRegistry.quests().map((quest) => ({ key: quest.key, label: quest.label }));
}

export function OnboardingProgressTable({ rows, quests = installedQuests() }: Props) {
  if (rows.length === 0) {
    return <p className="v-pro-note">No contributors yet.</p>;
  }

  return (
    <div className="v-pro-table" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead className="v-pro-thead-row">
          <tr>
            <th style={{ textAlign: "left" }}>Contributor</th>
            {quests.map((q) => (
              <th key={q.key} style={{ textAlign: "center" }}>
                {q.label}
              </th>
            ))}
            <th style={{ textAlign: "right" }}>Status</th>
          </tr>
        </thead>
        <tbody className="v-pro-tbody">
          {rows.map((row) => {
            const done = new Set(row.completed.map((completion) => completion.quest_key));
            const completedCount = quests.filter((q) => done.has(q.key)).length;
            const isDone = quests.length > 0 && completedCount === quests.length;
            return (
              <tr key={row.user_id} style={isDone ? { opacity: 0.7 } : undefined}>
                <td>
                  <span className="v-pro-tr-name">
                    <VitrineAvatar
                      name={row.full_name}
                      avatarUrl={row.avatar_url ?? undefined}
                      size="1.5rem"
                      ring={false}
                    />
                    <span>{row.full_name}</span>
                  </span>
                </td>
                {quests.map((q) => (
                  <td key={q.key} style={{ textAlign: "center" }}>
                    {done.has(q.key) ? (
                      <Check className="v-pro-quest-done" />
                    ) : (
                      <X className="v-pro-quest-todo" />
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "right" }}>
                  {isDone ? (
                    <span className="v-pro-score">Done</span>
                  ) : (
                    <span className="v-pro-digest-weak">{completedCount}/{quests.length}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
