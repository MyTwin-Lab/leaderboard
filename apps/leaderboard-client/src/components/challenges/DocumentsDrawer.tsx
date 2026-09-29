'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, Trash2, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Drawer } from '@/components/vitrine/Drawer';
import { renderMarkdown } from '@/components/ui/Markdown';

// La typographie `vitrine` du Markdown (`v-md-*`) vit dans la feuille de la
// page challenge ; le tiroir la charge lui-même, car il s'ouvre aussi depuis
// la vue de pilotage.
import '@/components/challenges/vitrine/challenge-vitrine.css';
import './challenge-overlays-vitrine.css';

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

/**
 * Le tiroir Docs : la liste des documents d'un challenge, leur lecture, et —
 * pour un admin — leur dépôt et leur suppression. Sur le tiroir du design
 * vitrine.
 */
export function DocumentsDrawer({ challengeId, isAdmin = false, open, onClose }: DocumentsDrawerProps) {
  const [docs, setDocs] = useState<ChallengeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ChallengeDoc | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Un document ouvert se referme d'abord : Échap, la croix et le fond
  // ramènent à la liste, puis ferment le tiroir.
  const close = () => {
    if (selectedDoc) setSelectedDoc(null);
    else onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      icon={<FileText />}
      title={selectedDoc ? selectedDoc.filename : 'Documents'}
      subtitle={selectedDoc ? fmtDate(selectedDoc.created_at) : `${docs.length} document${docs.length === 1 ? '' : 's'}`}
    >
      {selectedDoc ? (
        // ── Document viewer ──
        <>
          <div className="v-co-viewer-head">
            <button type="button" onClick={() => setSelectedDoc(null)} className="v-btn-text">
              <ArrowLeft />
              Documents
            </button>
            <button type="button" onClick={() => downloadDoc(selectedDoc)} className="v-btn-quiet v-btn-sm">
              <Download />
              Download
            </button>
          </div>
          <div className="v-co-viewer v-cd-md">
            {renderMarkdown(selectedDoc.content, 'vitrine')}
          </div>
        </>
      ) : loading ? (
        // ── Loading ──
        <div className="v-quiet" data-busy="true">
          <Loader2 className="v-spin" />
          Loading…
        </div>
      ) : (
        // ── Documents list ──
        <>
          {/* Drag & drop zone — admin only */}
          {isAdmin && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="v-co-drop"
              data-over={dragOver ? 'true' : 'false'}
              data-busy={uploading ? 'true' : 'false'}
            >
              {uploading ? <Loader2 className="v-spin" /> : <Upload />}
              <span className="v-co-drop-title">
                {uploading ? 'Uploading…' : 'Drop a .md file or click to browse'}
              </span>
              {!uploading && <span className="v-co-drop-hint">Markdown files only</span>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
              />
            </div>
          )}

          {uploadError && <p className="v-alert">{uploadError}</p>}

          {/* Document list */}
          {docs.length === 0 ? (
            <div className="v-co-empty">
              <FileText />
              <p className="v-co-empty-title">No documents yet</p>
              {isAdmin && <p className="v-co-empty-sub">Upload a .md file above</p>}
            </div>
          ) : (
            <div className="v-rows">
              {docs.map(doc => (
                <div key={doc.uuid} className="v-row v-co-doc">
                  <FileText />
                  <div className="v-row-text">
                    <button type="button" onClick={() => setSelectedDoc(doc)} className="v-co-doc-name">
                      {doc.filename}
                    </button>
                    <p className="v-row-meta">{fmtDate(doc.created_at)}</p>
                  </div>
                  <div className="v-row-actions">
                    <button type="button" onClick={() => downloadDoc(doc)} title="Download" className="v-btn-icon">
                      <Download />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.uuid}
                        title="Delete"
                        className="v-btn-icon"
                        data-tone="danger"
                      >
                        {deletingId === doc.uuid ? <Loader2 className="v-spin" /> : <Trash2 />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
