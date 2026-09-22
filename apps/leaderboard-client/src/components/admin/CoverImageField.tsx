"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { IMAGE_ACCEPT, useImageUpload } from "@/lib/useImageUpload";

interface CoverImageFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * La couverture d'un challenge, dans le langage visuel du tiroir admin.
 *
 * Deux entrées pour une seule valeur : déposer un fichier (réduit puis envoyé
 * à `/api/images`, qui rend une URL) ou coller une URL. L'aperçu affiche ce
 * que la carte du listing montrera — même cadrage, même dégradé.
 */
export function CoverImageField({ value, onChange }: CoverImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useImageUpload();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file);
    if (url) onChange(url);
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- source libre : URL externe ou /api/images */}
          <img src={value} alt="" className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove the cover image"
            className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] transition-colors hover:border-brandCP/40 disabled:opacity-60"
          style={{ color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="text-xs">{uploading ? "Uploading…" : "Upload a cover image"}</span>
          <span className="text-[11px] opacity-70">PNG, JPEG, WebP — resized to 1600px</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
          style={{ color: "var(--foreground)" }}
        />
        {value && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs transition-colors hover:border-white/25 disabled:opacity-50"
            style={{ color: "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
          >
            {uploading ? "Uploading…" : "Replace"}
          </button>
        )}
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
