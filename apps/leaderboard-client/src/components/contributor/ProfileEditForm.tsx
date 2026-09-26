"use client";

import { useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, User } from "lucide-react";
import { GitHubIcon as Github } from "@/components/ui/GitHubIcon";

type EditableField = "firstName" | "lastName" | "githubUsername";

interface FormValues {
  firstName: string;
  lastName: string;
  githubUsername: string;
}

interface ProfileEditFormProps {
  initialValues: FormValues;
  fields?: EditableField[];
  initialAvatarUrl?: string | null; // kept for avatar preview in the form
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * L'onglet Profile, d'après `Profile Vitrine.dc.html` : deux champs de nom côte
 * à côte, le pseudo GitHub derrière son `@`, et l'état de sauvegarde seul en bas
 * à droite. Rien à valider — chaque champ s'enregistre quand on le quitte.
 */
export function ProfileEditForm({
  initialValues,
  fields = ["firstName", "lastName", "githubUsername"],
}: ProfileEditFormProps) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedValues = useRef<FormValues>(initialValues);

  const save = async (current: FormValues) => {
    setStatus("saving");
    const fullName = [current.firstName.trim(), current.lastName.trim()].filter(Boolean).join(" ");
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
    if (current[field] !== savedValues.current[field]) save(current);
  };

  const showName = fields.includes("firstName") || fields.includes("lastName");
  const showGithub = fields.includes("githubUsername");

  return (
    <>
      {showName && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <span className="v-pro-legend-title">
            <User />
            Identity
          </span>
          <div className="v-pro-fields">
            {fields.includes("firstName") && (
              <Field
                label="First name"
                value={values.firstName}
                placeholder="Jean"
                onChange={v => setValues(prev => ({ ...prev, firstName: v }))}
                onBlur={() => handleBlur("firstName", values)}
              />
            )}
            {fields.includes("lastName") && (
              <Field
                label="Last name"
                value={values.lastName}
                placeholder="Dupont"
                onChange={v => setValues(prev => ({ ...prev, lastName: v }))}
                onBlur={() => handleBlur("lastName", values)}
              />
            )}
          </div>
        </div>
      )}

      {showGithub && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span className="v-pro-legend-title">
            <Github />
            GitHub
          </span>
          <div className="v-pro-prefixed">
            <span className="v-pro-prefix">@</span>
            <input
              type="text"
              value={values.githubUsername}
              placeholder="username"
              onChange={e => setValues(prev => ({ ...prev, githubUsername: e.target.value }))}
              onBlur={() => handleBlur("githubUsername", values)}
            />
          </div>
        </div>
      )}

      {/* La place de l'état est réservée, même au repos : l'apparition de
          « Saved » ne doit pas faire sauter la carte. */}
      <div className="v-pro-save">
        {status === "saving" && (
          <span data-state="saving">
            <Loader2 className="animate-spin" />
            Saving…
          </span>
        )}
        {status === "saved" && (
          <span data-state="saved">
            <CheckCircle2 />
            Saved
          </span>
        )}
        {status === "error" && (
          <span data-state="error">
            <AlertCircle />
            Failed to save
          </span>
        )}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="v-pro-field">
      <span className="v-pro-field-label">{label}</span>
      <input
        className="v-pro-input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </label>
  );
}
