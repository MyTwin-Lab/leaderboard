"use client";

import { useState } from "react";

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
      enabled: meetingsEnabled,
    },
    {
      key: "onboarding_enabled" as const,
      label: "Onboarding",
      description: "Show the onboarding quest drawer for contributors",
      enabled: onboardingEnabled,
    },
  ];

  return (
    <>
      <span className="v-pro-kicker">Modules</span>
      {modules.map((mod) => (
        <div key={mod.key} className="v-pro-switch-row">
          <div className="v-pro-switch-text">
            <span className="v-pro-switch-label">{mod.label}</span>
            <span className="v-pro-switch-desc">{mod.description}</span>
          </div>
          <button
            onClick={() => toggle(mod.key, !mod.enabled)}
            className="v-pro-toggle"
            data-on={mod.enabled}
            aria-label={`Toggle ${mod.label}`}
            aria-pressed={mod.enabled}
            style={saving === mod.key ? { opacity: 0.5 } : undefined}
          >
            <span />
          </button>
        </div>
      ))}
    </>
  );
}
