"use client";

import { useRef, useState } from "react";

type EditableField = "firstName" | "lastName" | "githubUsername";

interface FormValues {
  firstName: string;
  lastName: string;
  githubUsername: string;
}

interface ProfileEditFormProps {
  initialValues: FormValues;
  fields?: EditableField[];
}

const fieldConfig: Record<EditableField, { label: string; placeholder: string }> = {
  firstName: { label: "Prénom", placeholder: "Jean" },
  lastName: { label: "Nom", placeholder: "Dupont" },
  githubUsername: { label: "GitHub Username", placeholder: "jeandupont" },
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ProfileEditForm({
  initialValues,
  fields = ["firstName", "lastName", "githubUsername"],
}: ProfileEditFormProps) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedValues = useRef<FormValues>(initialValues);

  const save = async (current: FormValues) => {
    setStatus("saving");

    const fullName = [current.firstName.trim(), current.lastName.trim()]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("/api/contributors/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName || undefined,
        github_username: current.githubUsername,
      }),
    });

    if (res.ok) {
      savedValues.current = current;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleBlur = (field: EditableField, current: FormValues) => {
    if (current[field] !== savedValues.current[field]) {
      save(current);
    }
  };

  const showNameRow = fields.includes("firstName") || fields.includes("lastName");
  const showGithub = fields.includes("githubUsername");

  return (
    <div className="space-y-3">
      {showNameRow && (
        <div className="grid grid-cols-2 gap-3">
          {fields.includes("firstName") && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">
                {fieldConfig.firstName.label}
              </label>
              <input
                type="text"
                value={values.firstName}
                placeholder={fieldConfig.firstName.placeholder}
                onChange={(e) =>
                  setValues((v) => ({ ...v, firstName: e.target.value }))
                }
                onBlur={() => handleBlur("firstName", values)}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-brandCP focus:border-brandCP/50 transition"
              />
            </div>
          )}
          {fields.includes("lastName") && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">
                {fieldConfig.lastName.label}
              </label>
              <input
                type="text"
                value={values.lastName}
                placeholder={fieldConfig.lastName.placeholder}
                onChange={(e) =>
                  setValues((v) => ({ ...v, lastName: e.target.value }))
                }
                onBlur={() => handleBlur("lastName", values)}
                className="w-full rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-brandCP focus:border-brandCP/50 transition"
              />
            </div>
          )}
        </div>
      )}

      {showGithub && (
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1">
            {fieldConfig.githubUsername.label}
          </label>
          <input
            type="text"
            value={values.githubUsername}
            placeholder={fieldConfig.githubUsername.placeholder}
            onChange={(e) =>
              setValues((v) => ({ ...v, githubUsername: e.target.value }))
            }
            onBlur={() => handleBlur("githubUsername", values)}
            className="w-full rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-brandCP focus:border-brandCP/50 transition"
          />
        </div>
      )}

      <div className="h-4 flex items-center">
        {status === "saving" && (
          <span className="text-xs text-white/40">Sauvegarde...</span>
        )}
        {status === "saved" && (
          <span className="text-xs text-green-400">Enregistré</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-400">Erreur lors de la sauvegarde</span>
        )}
      </div>
    </div>
  );
}
