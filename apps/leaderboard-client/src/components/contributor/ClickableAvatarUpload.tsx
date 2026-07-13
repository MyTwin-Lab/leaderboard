"use client";

import { useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { Pencil, Loader2 } from "lucide-react";

interface ClickableAvatarUploadProps {
  name: string;
  size?: number;
  initialAvatarUrl?: string | null;
}

function compressAvatar(file: File, size = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ClickableAvatarUpload({ name, size = 64, initialAvatarUrl }: ClickableAvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const inputId = "avatar-upload-header";

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const compressed = await compressAvatar(file, 200);
      const res = await fetch("/api/contributors/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: compressed }),
      });
      if (res.ok) setAvatarUrl(compressed);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="relative shrink-0 animate-count-in" style={{ animationDelay: "0ms" }}>
      <label
        htmlFor={inputId}
        className="group relative block cursor-pointer overflow-hidden rounded-3xl"
        style={{ width: size, height: size }}
        aria-label="Change profile photo"
      >
        <InitialsAvatar name={name} size={size} avatarUrl={avatarUrl ?? undefined} />

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {uploading
            ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "white" }} />
            : <Pencil className="h-4 w-4" style={{ color: "white" }} />
          }
        </div>
      </label>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
        disabled={uploading}
      />
    </div>
  );
}
