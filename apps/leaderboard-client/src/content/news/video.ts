import type { NewsVideo } from "./types";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", fr: "French" };

/**
 * « In French, with English subtitles. » : ce qu'on dit sous un lecteur, rien
 * pour une vidéo en anglais sans sous-titres.
 */
export function videoLanguageNote(video: NewsVideo): string | null {
  const spoken = video.language === "en" ? null : (LANGUAGE_NAMES[video.language] ?? video.language);
  const subtitles = video.captions ? `${video.captions.label} subtitles` : null;
  if (spoken && subtitles) return `In ${spoken}, with ${subtitles}.`;
  if (spoken) return `In ${spoken}.`;
  if (subtitles) return `With ${subtitles}.`;
  return null;
}
