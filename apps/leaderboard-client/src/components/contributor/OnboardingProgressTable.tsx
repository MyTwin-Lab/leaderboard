import { Check, X } from "lucide-react";
import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import type { OnboardingProgressWithUser } from "@packages/database-service/domain/entities";

const QUESTS: {
  key: keyof Pick<
    OnboardingProgressWithUser,
    "clicked_challenge" | "assigned_task" | "evaluated_contribution" | "validated_task" | "joined_meeting"
  >;
  label: string;
}[] = [
  { key: "clicked_challenge", label: "Explore" },
  { key: "assigned_task", label: "Assign" },
  { key: "evaluated_contribution", label: "Evaluate" },
  { key: "validated_task", label: "Validate" },
  { key: "joined_meeting", label: "Meeting" },
];

interface Props {
  rows: OnboardingProgressWithUser[];
}

/**
 * La table d'avancement de l'onboarding, à la matière de
 * `Profile Vitrine.dc.html` : une carte blanche, un en-tête gris, un filet par
 * ligne.
 *
 * La maquette montre trois colonnes de dates ; ici ce sont les cinq quêtes
 * réelles, cochées ou non — c'est ce que la base porte.
 */
export function OnboardingProgressTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="v-pro-note">No contributors yet.</p>;
  }

  return (
    <div className="v-pro-table" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead className="v-pro-thead-row">
          <tr>
            <th style={{ textAlign: "left" }}>Contributor</th>
            {QUESTS.map((q) => (
              <th key={q.key} style={{ textAlign: "center" }}>
                {q.label}
              </th>
            ))}
            <th style={{ textAlign: "right" }}>Status</th>
          </tr>
        </thead>
        <tbody className="v-pro-tbody">
          {rows.map((row) => {
            const completedCount = QUESTS.filter((q) => row[q.key]).length;
            const isDone = !!row.completed_at;
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
                {QUESTS.map((q) => (
                  <td key={q.key} style={{ textAlign: "center" }}>
                    {row[q.key] ? (
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
                    <span className="v-pro-digest-weak">{completedCount}/5</span>
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
