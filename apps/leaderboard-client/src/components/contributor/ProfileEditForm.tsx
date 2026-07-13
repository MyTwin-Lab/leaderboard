"use client";

import { useRef, useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { CheckCircle2, AlertCircle, Loader2, User, Github } from "lucide-react";

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


export function ProfileEditForm({
  initialValues,
  fields = ["firstName", "lastName", "githubUsername"],
  initialAvatarUrl = null,
}: ProfileEditFormProps) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [avatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const savedValues = useRef<FormValues>(initialValues);

  const displayName = [values.firstName, values.lastName].filter(Boolean).join(" ") || "—";

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
    <div className="animate-fade-up space-y-8">
      {/* Fields */}
      <div className="space-y-5">

        {/* Name */}
        {showName && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <User className="h-3.5 w-3.5" />
              Identity
            </h2>
            <div className="grid grid-cols-2 gap-3">
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

        {/* GitHub */}
        {showGithub && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <Github className="h-3.5 w-3.5" />
              GitHub
            </h2>
            <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-200 focus-within:border-brandCP/40 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]">
              <span className="select-none pl-3.5 text-sm text-white/25">@</span>
              <input
                type="text"
                value={values.githubUsername}
                placeholder="username"
                onChange={e => setValues(prev => ({ ...prev, githubUsername: e.target.value }))}
                onBlur={() => handleBlur("githubUsername", values)}
                className="flex-1 bg-transparent py-2.5 pr-3.5 pl-1 text-sm text-white placeholder:text-white/20 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save status */}
      <div className="flex items-center justify-end h-5">
        {status === "saving" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-white/35">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </span>
        )}
        {status === "saved" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        {status === "error" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed to save
          </span>
        )}
      </div>
    </div>
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
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/25">
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:bg-white/[0.05] focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
      />
    </div>
  );
}
