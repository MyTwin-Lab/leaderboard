"use client";

import { useCallback, useState } from "react";

/**
 * Le dépôt d'une image de couverture, sans le moindre habillage.
 *
 * L'image est réduite dans un canvas **avant** l'envoi : une photo de
 * téléphone pèse plusieurs méga-octets pour un usage qui n'en demande que
 * quelques centaines de kilo. La réduction se fait donc chez l'appelant, pas
 * sur le serveur — qui n'a ni pipeline d'images ni stockage objet.
 *
 * Deux formulaires s'en servent, dans deux langages visuels différents (le
 * tiroir admin d'un challenge, la modale vitrine d'un sandbox) : ce hook porte
 * la mécanique, chacun dessine son champ.
 */

/** Le plus grand côté d'une couverture après réduction. */
const MAX_EDGE = 1600;

/** Le plafond de l'API, répété ici pour refuser avant l'aller-retour. */
const MAX_BYTES = 3 * 1024 * 1024;

const ACCEPTED = ["image/webp", "image/png", "image/jpeg", "image/avif", "image/gif"];

/** L'attribut `accept` d'un `<input type="file">`, aligné sur ce que l'API accepte. */
export const IMAGE_ACCEPT = ACCEPTED.join(",");

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file isn’t a readable image."));
    };
    img.src = url;
  });
}

/**
 * La data URL d'une image réduite à `MAX_EDGE`.
 *
 * Un GIF est renvoyé tel quel : le repasser dans un canvas n'en garderait que
 * la première image.
 */
async function toUploadable(file: File): Promise<{ data: string; mimeType: string }> {
  const asDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Couldn’t read this file."));
      reader.readAsDataURL(file);
    });

  if (file.type === "image/gif") {
    return { data: await asDataUrl(), mimeType: file.type };
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));

  // Déjà assez petite : on garde le fichier d'origine plutôt que de le
  // ré-encoder, ce qui ne ferait que perdre de la qualité.
  if (scale === 1 && file.size <= 600 * 1024) {
    return { data: await asDataUrl(), mimeType: file.type };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return { data: await asDataUrl(), mimeType: file.type };
  context.drawImage(img, 0, 0, canvas.width, canvas.height);

  const webp = canvas.toDataURL("image/webp", 0.85);
  // Un navigateur qui ne sait pas encoder en WebP renvoie du PNG : on prend
  // ce qu'il donne plutôt que d'échouer.
  const mimeType = webp.startsWith("data:image/webp") ? "image/webp" : "image/png";
  return { data: mimeType === "image/webp" ? webp : canvas.toDataURL("image/png"), mimeType };
}

export interface ImageUpload {
  /** Dépose un fichier et rend l'URL servie par l'app, ou `null` en cas d'échec. */
  upload: (file: File) => Promise<string | null>;
  uploading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useImageUpload(): ImageUpload {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<string | null> => {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("PNG, JPEG, WebP, AVIF or GIF only.");
      return null;
    }

    setUploading(true);
    try {
      const { data, mimeType } = await toUploadable(file);
      // La longueur d'une data URL en base64 dépasse la taille des octets d'un
      // tiers : on compare sur les octets, comme l'API.
      const bytes = Math.floor((data.length - data.indexOf(",") - 1) * 0.75);
      if (bytes > MAX_BYTES) {
        setError("This image is too large (max 3 MB once resized).");
        return null;
      }

      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, mime_type: mimeType }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Couldn’t upload this image.");
        return null;
      }

      const payload = (await response.json()) as { url: string };
      return payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t upload this image.");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error, clearError: () => setError(null) };
}
