"use client";

import { useState } from "react";
import { Video, Compass } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";

interface Props {
  meetingsEnabled: boolean;
  onboardingEnabled: boolean;
}

export function ModulesSettings({ meetingsEnabled: initialMeetings, onboardingEnabled: initialOnboarding }: Props) {
  const [meetingsEnabled, setMeetingsEnabled] = useState(initialMeetings);
  const [onboardingEnabled, setOnboardingEnabled] = useState(initialOnboarding);
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (key: "meetings_enabled" | "onboarding_enabled", value: boolean) => {
    setSaving(key);
    if (key === "meetings_enabled") setMeetingsEnabled(value);
    else setOnboardingEnabled(value);

    try {
      await fetch("/api/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      if (key === "meetings_enabled") setMeetingsEnabled(!value);
      else setOnboardingEnabled(!value);
    } finally {
      setSaving(null);
    }
  };

  const modules = [
    {
      key: "meetings_enabled" as const,
      label: "Meetings",
      description: "Show the meetings sidebar in challenge views for contributors",
      icon: <Video className="h-4 w-4 text-white/50" />,
      enabled: meetingsEnabled,
    },
    {
      key: "onboarding_enabled" as const,
      label: "Onboarding",
      description: "Show the onboarding quest drawer for contributors",
      icon: <Compass className="h-4 w-4 text-white/50" />,
      enabled: onboardingEnabled,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
        Modules
      </h2>
      {modules.map((mod) => (
        <div
          key={mod.key}
          className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            {mod.icon}
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{mod.label}</p>
              <p className="text-xs text-white/35 mt-0.5">{mod.description}</p>
            </div>
          </div>
          <div className={`shrink-0 transition-opacity ${saving === mod.key ? "opacity-50" : ""}`}>
            <Toggle enabled={mod.enabled} onChange={(v) => toggle(mod.key, v)} />
          </div>
        </div>
      ))}
    </div>
  );
}
