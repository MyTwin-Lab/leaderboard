/**
 * Normalisation des URLs d'artefacts (Kaggle, GitHub).
 *
 * Deux contributeurs qui soumettent le même dataset ne collent pas forcément
 * une chaîne identique : trailing slash, casse, `?utm_source=...`, `/versions/2`.
 * Cette fonction ramène ces variantes à une clé unique — c'est elle qui décide
 * si une soumission est une réutilisation, donc si des points changent de mains.
 */

/** Ramène une URL Kaggle/GitHub à une clé stable, ou null si elle est inexploitable. */
export function normalizeArtifactUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean).map(s => s.toLowerCase());

  if (host === 'kaggle.com') {
    return normalizeKaggle(segments) ?? fallback(host, segments);
  }
  if (host === 'github.com') {
    return normalizeGithub(segments) ?? fallback(host, segments);
  }
  return fallback(host, segments);
}

/**
 * kaggle.com/datasets/owner/slug[/versions/N] → kaggle.com/datasets/owner/slug
 * kaggle.com/models/owner/slug[/framework/...] → kaggle.com/models/owner/slug
 *
 * On coupe après owner/slug : une nouvelle version d'un dataset reste le même
 * dataset, donc la réutilisation doit être détectée à travers les versions.
 */
function normalizeKaggle(segments: string[]): string | null {
  const kind = segments[0];
  if (kind !== 'datasets' && kind !== 'models') return null;
  const [owner, slug] = [segments[1], segments[2]];
  if (!owner || !slug) return null;
  return `kaggle.com/${kind}/${owner}/${slug}`;
}

/** github.com/owner/repo[.git][/tree/...] → github.com/owner/repo */
function normalizeGithub(segments: string[]): string | null {
  const [owner, repo] = [segments[0], segments[1]];
  if (!owner || !repo) return null;
  return `github.com/${owner}/${repo.replace(/\.git$/, '')}`;
}

/** Hôte inconnu : on garde le chemin entier, sans query ni fragment. */
function fallback(host: string, segments: string[]): string | undefined {
  if (segments.length === 0) return undefined;
  return `${host}/${segments.join('/')}`;
}

/**
 * Extrait le ref "owner/slug" attendu par les connecteurs.
 *
 * Passe par la normalisation, donc gère les chemins profonds : une URL de
 * modèle Kaggle avec framework et variation (`/models/alice/bert/pyTorch/base/1`)
 * donne bien `alice/bert`, et non les deux derniers segments.
 */
export function extractArtifactRef(raw: string | null | undefined): string | undefined {
  const normalized = normalizeArtifactUrl(raw);
  if (!normalized) return undefined;

  const segments = normalized.split('/');
  // kaggle.com/{datasets|models}/owner/slug → 4 segments
  // github.com/owner/repo → 3 segments
  const owner = segments[segments.length - 2];
  const slug = segments[segments.length - 1];
  if (!owner || !slug) return undefined;
  return `${owner}/${slug}`;
}
