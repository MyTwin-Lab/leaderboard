import { Check, X } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { PlatformRegistry } from "@packages/registry/platform";
import type { OnboardingProgressWithUser } from "@packages/database-service/domain/entities";

interface Props {
  rows: OnboardingProgressWithUser[];
  /** Les colonnes : les quêtes installées, dans leur ordre, par défaut. */
  quests?: { key: string; label: string }[];
}

function installedQuests(): { key: string; label: string }[] {
  if (!PlatformRegistry.isInstalled()) return [];
  return PlatformRegistry.quests().map((quest) => ({ key: quest.key, label: quest.label }));
}

export function OnboardingProgressTable({ rows, quests = installedQuests() }: Props) {
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
            {quests.map((q) => (
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
            const done = new Set(row.completed.map((completion) => completion.quest_key));
            const completedCount = quests.filter((q) => done.has(q.key)).length;
            const isDone = quests.length > 0 && completedCount === quests.length;
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
                {quests.map((q) => (
                  <td key={q.key} className="py-3 px-2 text-center">
                    {done.has(q.key) ? (
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
                    <span className="text-xs text-white/30">{completedCount}/{quests.length}</span>
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
