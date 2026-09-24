import { ensweetCardiacRehabilitation } from "./ensweet-cardiac-rehabilitation";
import { healthguardPatientControlledRecords } from "./healthguard-patient-controlled-records";
import { iVirtualCameraVitalSigns } from "./i-virtual-camera-vital-signs";
import { mammographyAiChallenges } from "./mammography-ai-challenges";
import { mykine } from "./mykine";
import { mytwinAccessibility } from "./mytwin-accessibility";
import { petScan3dAnatomicalModel } from "./pet-scan-3d-anatomical-model";
import { racketSportsInjuryRisk } from "./racket-sports-injury-risk";
import { scanEngineFullBody3dAvatar } from "./scan-engine-full-body-3d-avatar";
import { skiniveAiSkinChecks } from "./skinive-ai-skin-checks";
import type { NewsArticle } from "./types";
import { virtuosisAiVoiceAnalysis } from "./virtuosis-ai-voice-analysis";
import { ynovAiHealthFrenchResponse } from "./ynov-ai-health-french-response";

/**
 * Le registre des news. Ajouter une news = un dossier `<slug>/` + une ligne ici.
 *
 * L'ordre affiché suit `eventMonth`, du plus récent au plus ancien : une news
 * raconte un moment de l'histoire du Lab, et plusieurs peuvent paraître le même
 * jour sur des événements éloignés. À mois égal, l'ordre de ce tableau fait foi.
 */
const ARTICLES: readonly NewsArticle[] = [
  mykine,
  mytwinAccessibility,
  mammographyAiChallenges,
  ynovAiHealthFrenchResponse,
  scanEngineFullBody3dAvatar,
  petScan3dAnatomicalModel,
  healthguardPatientControlledRecords,
  ensweetCardiacRehabilitation,
  racketSportsInjuryRisk,
  virtuosisAiVoiceAnalysis,
  skiniveAiSkinChecks,
  iVirtualCameraVitalSigns,
];

export const NEWS_ARTICLES: readonly NewsArticle[] = [...ARTICLES].sort((a, b) =>
  b.eventMonth.localeCompare(a.eventMonth),
);

export function getNewsBySlug(slug: string): NewsArticle | undefined {
  return NEWS_ARTICLES.find((article) => article.slug === slug);
}

/**
 * Les trois news de la home, dans cet ordre : une sélection fixe, pas les plus
 * récentes. La première est la une, les deux suivantes des brèves.
 */
export const HOME_NEWS: readonly NewsArticle[] = [mykine, ynovAiHealthFrenchResponse, mammographyAiChallenges];

/**
 * Même catégorie d'abord : un lecteur venu pour un partenaire a plus de chances
 * de poursuivre sur les autres partenaires que sur un challenge.
 */
export function getRelatedNews(article: NewsArticle, count = 2): NewsArticle[] {
  const others = NEWS_ARTICLES.filter((other) => other.slug !== article.slug);
  return [
    ...others.filter((other) => other.category === article.category),
    ...others.filter((other) => other.category !== article.category),
  ].slice(0, count);
}
