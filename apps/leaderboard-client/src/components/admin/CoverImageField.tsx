"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { IMAGE_ACCEPT, useImageUpload } from "@/lib/useImageUpload";

// Le vocabulaire de la couverture (`.v-cover*`) est celui de la modale de
// sandbox : même zone de dépôt, même aperçu, même rangée URL + Replace.
import "@/components/sandbox/sandbox-vitrine.css";

interface CoverImageFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * La couverture d'un challenge, dans le langage visuel du tiroir.
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
    <div className="v-cover">
      {value ? (
        <div className="v-cover-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- source libre : URL externe ou /api/images */}
          <img src={value} alt="" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove the cover image"
            className="v-cover-remove"
          >
            <X />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="v-cover-drop"
        >
          {uploading ? <Loader2 className="v-spin" /> : <ImagePlus />}
          <span className="v-cover-drop-title">{uploading ? "Uploading…" : "Upload a cover image"}</span>
          <span className="v-cover-drop-hint">PNG, JPEG, WebP — resized to 1600px</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="v-cover-row">
        {/* `text`, pas `url` : une image déposée vaut `/api/images/<uuid>`, un
            chemin relatif que la validation native d'un champ `url` refuse —
            elle veut une adresse absolue. Le champ accepte les deux formes,
            et c'est `coverImageUrlSchema` qui trie côté serveur. Invisible
            tant que le champ vivait dans le tiroir, qui n'a pas de `<form>` :
            rien ne déclenchait la contrainte. */}
        <input
          type="text"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="v-input"
        />
        {value && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="v-cover-replace"
          >
            {uploading ? "Uploading…" : "Replace"}
          </button>
        )}
      </div>

      {error && <p className="v-field-error">{error}</p>}
    </div>
  );
}
