'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, FileText, Upload, Trash2, ArrowLeft, Download, Loader2 } from 'lucide-react';

interface ChallengeDoc {
  uuid: string;
  challenge_id: string;
  filename: string;
  content: string;
  created_at: string;
}

interface DocumentsDrawerProps {
  challengeId: string;
  isAdmin?: boolean;
  open: boolean;
  onClose: () => void;
}

// ─── Lightweight Markdown → JSX renderer ──────────────────────────────────────

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const inlineRender = (text: string): React.ReactNode => {
    // Process inline: bold, italic, inline-code, links
    const parts: React.ReactNode[] = [];
    let rest = text;
    let key = 0;

    while (rest.length > 0) {
      const codeMatch = rest.match(/^([\s\S]*?)(`[^`]+`)/);
      const boldMatch = rest.match(/^([\s\S]*?)(\*\*[^*]+\*\*)/);
      const italicMatch = rest.match(/^([\s\S]*?)(\*[^*]+\*)/);
      const linkMatch = rest.match(/^([\s\S]*?)(\[[^\]]+\]\([^)]+\))/);

      const candidates = [codeMatch, boldMatch, italicMatch, linkMatch]
        .filter(Boolean)
        .sort((a, b) => (a![1].length) - (b![1].length));

      if (candidates.length === 0) {
        parts.push(rest);
        break;
      }

      const match = candidates[0]!;
      if (match[1]) parts.push(match[1]);

      const token = match[2];
      if (token.startsWith('`')) {
        parts.push(<code key={key++} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-brandCP/80">{token.slice(1, -1)}</code>);
      } else if (token.startsWith('**')) {
        parts.push(<strong key={key++} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*')) {
        parts.push(<em key={key++} className="italic text-white/80">{token.slice(1, -1)}</em>);
      } else if (token.startsWith('[')) {
        const linkText = token.match(/\[([^\]]+)\]/)?.[1] ?? '';
        const linkHref = token.match(/\(([^)]+)\)/)?.[1] ?? '';
        parts.push(
          <a key={key++} href={linkHref} target="_blank" rel="noopener noreferrer"
            className="text-brandCP underline underline-offset-2 hover:text-brandCP/70">
            {linkText}
          </a>
        );
      }

      rest = rest.slice(match[1].length + token.length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} className="my-3 overflow-x-auto rounded-xl bg-white/[0.05] p-4 font-mono text-xs leading-relaxed text-white/75">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);

    if (h1) {
      nodes.push(<h1 key={i} className="mt-5 mb-2 text-xl font-bold text-white">{inlineRender(h1[1])}</h1>);
      i++; continue;
    }
    if (h2) {
      nodes.push(<h2 key={i} className="mt-4 mb-1.5 text-base font-semibold text-white">{inlineRender(h2[1])}</h2>);
      i++; continue;
    }
    if (h3) {
      nodes.push(<h3 key={i} className="mt-3 mb-1 text-sm font-semibold text-white/90">{inlineRender(h3[1])}</h3>);
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-4 border-white/10" />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className="my-2 border-l-2 border-brandCP/40 pl-4 text-sm text-white/50 italic">
          {inlineRender(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // Unordered list item
    const ulItem = line.match(/^[-*]\s+(.*)/);
    if (ulItem) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+(.*)/)) {
        const m = lines[i].match(/^[-*]\s+(.*)/)!;
        items.push(<li key={i} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brandCP/50" /><span>{inlineRender(m[1])}</span></li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="my-2 space-y-1 text-sm text-white/70">{items}</ul>);
      continue;
    }

    // Ordered list item
    const olItem = line.match(/^\d+\.\s+(.*)/);
    if (olItem) {
      const items: React.ReactNode[] = [];
      let idx = 1;
      while (i < lines.length && lines[i].match(/^\d+\.\s+(.*)/)) {
        const m = lines[i].match(/^\d+\.\s+(.*)/)!;
        items.push(<li key={i} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 font-mono text-xs text-brandCP/50">{idx++}.</span><span>{inlineRender(m[1])}</span></li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} className="my-2 space-y-1 text-sm text-white/70">{items}</ol>);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++; continue;
    }

    // Normal paragraph
    nodes.push(<p key={i} className="my-1.5 text-sm leading-relaxed text-white/65">{inlineRender(line)}</p>);
    i++;
  }

  return nodes;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentsDrawer({ challengeId, isAdmin = false, open, onClose }: DocumentsDrawerProps) {
  const [docs, setDocs] = useState<ChallengeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ChallengeDoc | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (selectedDoc) setSelectedDoc(null); else onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, selectedDoc]);

  // Load documents when drawer opens
  useEffect(() => {
    if (!open) return;
    setSelectedDoc(null);
    setUploadError('');
    setLoading(true);
    fetch(`/api/challenges/${challengeId}/documents`)
      .then(r => r.json())
      .then((data: ChallengeDoc[]) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.md')) {
      setUploadError('Only .md files are allowed');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const content = await file.text();
      const res = await fetch(`/api/challenges/${challengeId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content }),
      });
      if (res.ok) {
        const doc: ChallengeDoc = await res.json();
        setDocs(prev => [...prev, doc]);
      } else {
        const d = await res.json();
        setUploadError(d.error || 'Upload failed');
      }
    } catch {
      setUploadError('Network error');
    } finally {
      setUploading(false);
    }
  }, [challengeId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDelete = async (doc: ChallengeDoc) => {
    setDeletingId(doc.uuid);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/documents/${doc.uuid}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs(prev => prev.filter(d => d.uuid !== doc.uuid));
        if (selectedDoc?.uuid === doc.uuid) setSelectedDoc(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const downloadDoc = (doc: ChallengeDoc) => {
    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-white/[0.07] shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--background-dark)', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            {selectedDoc ? (
              <button
                onClick={() => setSelectedDoc(null)}
                className="flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Documents
              </button>
            ) : (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.07]">
                  <FileText className="h-3.5 w-3.5 text-white/50" />
                </div>
                <h2 className="text-sm font-semibold text-white">Documents</h2>
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/40">{docs.length}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {selectedDoc ? (
            // ── Document viewer ──
            <div className="px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="truncate text-sm font-medium text-white/80">{selectedDoc.filename}</span>
                <button
                  onClick={() => downloadDoc(selectedDoc)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                {renderMarkdown(selectedDoc.content)}
              </div>
            </div>
          ) : loading ? (
            // ── Loading ──
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </div>
          ) : (
            // ── Documents list ──
            <div className="px-6 py-5 space-y-4">
              {/* Drag & drop zone — admin only */}
              {isAdmin && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 transition-all duration-200
                    ${dragOver
                      ? 'border-brandCP/50 bg-brandCP/[0.06]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-brandCP/50" />
                  ) : (
                    <Upload className={`h-6 w-6 transition-colors ${dragOver ? 'text-brandCP/70' : 'text-white/20'}`} />
                  )}
                  <div className="text-center">
                    <p className="text-sm text-white/40">
                      {uploading ? 'Uploading…' : 'Drop a .md file or click to browse'}
                    </p>
                    {!uploading && (
                      <p className="mt-0.5 text-xs text-white/20">Markdown files only</p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
                  />
                </div>
              )}

              {uploadError && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{uploadError}</p>
              )}

              {/* Document list */}
              {docs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <FileText className="h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/30">No documents yet</p>
                  {isAdmin && <p className="text-xs text-white/20">Upload a .md file above</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div
                      key={doc.uuid}
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-white/25" />
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="truncate text-sm font-medium text-white/75 transition-colors hover:text-white text-left"
                        >
                          {doc.filename}
                        </button>
                        <p className="text-[11px] text-white/25">{fmtDate(doc.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => downloadDoc(doc)}
                          title="Download"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.07] hover:text-white/60"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.uuid}
                            title="Delete"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                          >
                            {deletingId === doc.uuid
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
