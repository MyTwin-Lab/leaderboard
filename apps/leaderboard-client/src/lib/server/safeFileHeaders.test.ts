import { describe, it, expect } from 'vitest';
import { buildSafeFileHeaders } from './safeFileHeaders';

describe('buildSafeFileHeaders', () => {
  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])(
    'renders %s inline (allowlisted raster image)',
    (type) => {
      const headers = buildSafeFileHeaders(type, 'photo.png') as Record<string, string>;
      expect(headers['Content-Type']).toBe(type);
      expect(headers['Content-Disposition']).toMatch(/^inline;/);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    }
  );

  it('forces image/svg+xml to download rather than render inline (SVG can embed <script>)', () => {
    const headers = buildSafeFileHeaders('image/svg+xml', 'evil.svg') as Record<string, string>;
    expect(headers['Content-Disposition']).toMatch(/^attachment;/);
  });

  it('forces text/html to download rather than render inline', () => {
    const headers = buildSafeFileHeaders('text/html', 'page.html') as Record<string, string>;
    expect(headers['Content-Disposition']).toMatch(/^attachment;/);
    expect(headers['Content-Type']).toBe('text/html');
  });

  it('forces application/json and arbitrary content types to download', () => {
    expect((buildSafeFileHeaders('application/json', 'data.json') as Record<string, string>)['Content-Disposition']).toMatch(/^attachment;/);
    expect((buildSafeFileHeaders('application/octet-stream', 'blob.bin') as Record<string, string>)['Content-Disposition']).toMatch(/^attachment;/);
  });

  it('ignores a Content-Type parameter suffix (e.g. charset) when matching the allowlist', () => {
    const headers = buildSafeFileHeaders('image/png; charset=binary', 'photo.png') as Record<string, string>;
    expect(headers['Content-Type']).toBe('image/png');
    expect(headers['Content-Disposition']).toMatch(/^inline;/);
  });

  it('falls back to application/octet-stream and attachment when no content type is known', () => {
    const headers = buildSafeFileHeaders(null, 'mystery') as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/octet-stream');
    expect(headers['Content-Disposition']).toMatch(/^attachment;/);
  });

  it('always sets X-Content-Type-Options: nosniff, even for allowlisted images', () => {
    expect((buildSafeFileHeaders('image/png', 'a.png') as Record<string, string>)['X-Content-Type-Options']).toBe('nosniff');
    expect((buildSafeFileHeaders('text/plain', 'a.txt') as Record<string, string>)['X-Content-Type-Options']).toBe('nosniff');
  });

  it('strips CR/LF and quotes from a malicious filename to prevent header injection', () => {
    const headers = buildSafeFileHeaders('text/plain', 'evil\r\nX-Injected: yes".txt') as Record<string, string>;
    expect(headers['Content-Disposition']).not.toMatch(/[\r\n]/);
    expect(headers['Content-Disposition']).not.toContain('"');
  });

  it('falls back to a default filename when none is provided', () => {
    const headers = buildSafeFileHeaders('text/plain', null) as Record<string, string>;
    expect(headers['Content-Disposition']).toContain("filename*=UTF-8''file");
  });

  it('RFC-5987-encodes a filename with special/unicode characters', () => {
    const headers = buildSafeFileHeaders('text/plain', 'résumé (final).txt') as Record<string, string>;
    expect(headers['Content-Disposition']).toContain(encodeURIComponent('résumé (final).txt'));
  });
});
