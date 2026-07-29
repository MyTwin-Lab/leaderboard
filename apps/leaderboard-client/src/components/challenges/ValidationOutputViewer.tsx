'use client';

import { useEffect, useMemo, useState } from 'react';

interface ValidationOutputViewerProps {
  blob: Blob;
  contentType: string;
}

/** True for a string that looks like a base64/data-URI image, worth rendering inline. */
function looksLikeImageDataUri(value: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp);base64,/.test(value);
}

function JsonValue({ value }: { value: unknown }) {
  if (typeof value === 'string' && looksLikeImageDataUri(value)) {
    return <img src={value} alt="" className="max-h-64 rounded-lg border border-white/10" />;
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <pre className="whitespace-pre-wrap break-all text-xs text-white/60">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-xs text-white/70">{String(value)}</span>;
}

/**
 * Generic renderer for whatever a validated API returns: images render as
 * images, JSON renders field-by-field (with base64/data-URI image fields
 * detected and rendered inline), everything else falls back to raw text.
 */
export function ValidationOutputViewer({ blob, contentType }: ValidationOutputViewerProps) {
  const [text, setText] = useState<string | null>(null);
  const [json, setJson] = useState<Record<string, unknown> | null>(null);
  const objectUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => {
    if (contentType.startsWith('image/')) return;
    blob.text().then(t => {
      if (contentType.includes('application/json')) {
        try { setJson(JSON.parse(t)); return; } catch { /* fall through to plain text */ }
      }
      setText(t);
    });
  }, [blob, contentType]);

  if (contentType.startsWith('image/')) {
    return <img src={objectUrl} alt="Model output" className="max-h-96 rounded-xl border border-white/10" />;
  }

  if (json) {
    return (
      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        {Object.entries(json).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{key}</p>
            <JsonValue value={value} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-all rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-white/60">
      {text ?? 'Loading…'}
    </pre>
  );
}
