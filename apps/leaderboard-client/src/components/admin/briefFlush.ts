import { BRIEF_FILENAME } from '@/lib/challengeBrief';

/**
 * Enregistre le brief d'un challenge une fois que celui-ci existe.
 *
 * En création, le brief est saisi avant que le challenge n'ait d'identifiant :
 * il est bufferisé dans le tiroir puis flushé ici, comme les template tasks.
 * En édition, le challenge existe déjà et l'appel est direct.
 *
 * Le POST est idempotent côté API pour ce nom de fichier — réenregistrer
 * remplace le document au lieu d'en empiler un second.
 *
 * Ne jette jamais : le challenge, lui, est déjà sauvegardé, l'appelant a
 * seulement besoin de savoir s'il doit prévenir l'admin. Même contrat que
 * `templateTasksFlush`, et `fetchImpl` injectable pour les mêmes raisons.
 */
export async function flushBrief(
  challengeId: string,
  brief: string,
  existingBriefId: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean }> {
  const content = brief.trim();

  // Brief vidé : le document existant est supprimé, sinon la page challenge
  // continuerait d'afficher l'ancien texte devant le bouton Join.
  if (!content) {
    if (!existingBriefId) return { ok: true };
    try {
      const res = await fetchImpl(`/api/challenges/${challengeId}/documents/${existingBriefId}`, {
        method: 'DELETE',
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }

  try {
    const res = await fetchImpl(`/api/challenges/${challengeId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: BRIEF_FILENAME, content }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
