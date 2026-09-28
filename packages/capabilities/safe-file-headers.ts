/**
 * Hardens the headers used to serve back untrusted binary content (a
 * validator's uploaded file, or a third-party endpoint's raw response) —
 * both are attacker-influenced inputs now persisted and re-served to a
 * manager's browser, so the declared content type is never trusted blindly.
 *
 * Only a narrow raster-image allowlist is ever rendered inline; everything
 * else — including image/svg+xml, which can embed <script> — is forced to
 * download as an attachment so it never executes in the app's origin.
 */

const INLINE_SAFE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** Strips CR/LF and control chars, and RFC-5987-encodes for the filename* param, to prevent header injection via a user-supplied filename. */
function sanitizeFilename(filename: string | null): string {
  const fallback = 'file';
  if (!filename) return fallback;
  const cleaned = filename.replace(/[\x00-\x1f\x7f"]/g, '').trim();
  return cleaned || fallback;
}

export function buildSafeFileHeaders(contentType: string | null, filename: string | null): HeadersInit {
  const normalizedType = (contentType ?? '').split(';')[0].trim().toLowerCase();
  const safeType = normalizedType || 'application/octet-stream';
  const isInlineSafe = INLINE_SAFE_CONTENT_TYPES.has(safeType);
  const safeFilename = sanitizeFilename(filename);

  return {
    'Content-Type': safeType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${isInlineSafe ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
  };
}
