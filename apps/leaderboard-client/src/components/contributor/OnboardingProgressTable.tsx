import { Check, X } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
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

export function OnboardingProgressTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/30 py-8 text-center">No contributors yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8">
            <th className="pb-2 text-left text-xs font-semibold uppercase tracking-widest text-white/30 pr-4">
              Contributor
            </th>
            {QUESTS.map((q) => (
              <th
                key={q.key}
                className="pb-2 text-center text-xs font-semibold uppercase tracking-widest text-white/30 px-2"
              >
                {q.label}
              </th>
            ))}
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-widest text-white/30 pl-4">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const completedCount = QUESTS.filter((q) => row[q.key]).length;
            const isDone = !!row.completed_at;
            return (
              <tr
                key={row.user_id}
                className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${isDone ? "opacity-60" : ""}`}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar
                      name={row.full_name}
                      size={28}
                      avatarUrl={row.avatar_url ?? undefined}
                    />
                    <span className="text-sm text-white/80 truncate max-w-[140px]">
                      {row.full_name}
                    </span>
                  </div>
                </td>
                {QUESTS.map((q) => (
                  <td key={q.key} className="py-3 px-2 text-center">
                    {row[q.key] ? (
                      <Check className="h-3.5 w-3.5 text-brandCP mx-auto" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-white/20 mx-auto" />
                    )}
                  </td>
                ))}
                <td className="py-3 pl-4 text-right">
                  {isDone ? (
                    <span className="inline-flex items-center rounded-full bg-brandCP/10 px-2 py-0.5 text-[11px] font-medium text-brandCP">
                      Done
                    </span>
                  ) : (
                    <span className="text-xs text-white/30">{completedCount}/5</span>
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
