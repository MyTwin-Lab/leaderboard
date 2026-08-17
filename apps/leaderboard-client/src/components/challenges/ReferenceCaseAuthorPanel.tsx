'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus2, Loader2, AlertCircle, FileText } from 'lucide-react';

interface CaseSummary {
  id: string;
  inputFilename: string;
  createdAt: string;
}

/**
 * Contributor-facing, self-gated on role === 'medical_pro' — a medical_pro
 * writes exactly `requiredValidations` ground-truth reference cases for a
 * validation challenge. Renders nothing for anyone else, same as
 * ValidationTargetsEditor renders nothing for a non-manager.
 */
export function ReferenceCaseAuthorPanel({ challengeId }: { challengeId: string }) {
  const [role, setRole] = useState<string | null>(null);
  const [requiredValidations, setRequiredValidations] = useState(0);
  const [myCases, setMyCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [expectedMode, setExpectedMode] = useState<'file' | 'text'>('text');
  const [expectedFile, setExpectedFile] = useState<File | null>(null);
  const [expectedText, setExpectedText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const expectedFileRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, challengeRes, casesRes] = await Promise.all([
        fetch('/api/contributors/me'),
        fetch(`/api/challenges/${challengeId}`),
        fetch(`/api/challenges/${challengeId}/validation-reference-cases`),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setRole(me.user?.role ?? null);
      }
      if (challengeRes.ok) {
        const challenge = await challengeRes.json();
        setRequiredValidations(challenge.required_validations ?? 0);
      }
      if (casesRes.ok) {
        const data = await casesRes.json();
        setMyCases(data.cases ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading || role !== 'medical_pro') return null;

  const quotaReached = myCases.length >= requiredValidations && requiredValidations > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFile) {
      setError('Un fichier d’entrée est requis');
      return;
    }
    if (expectedMode === 'file' && !expectedFile) {
      setError('Un fichier de sortie attendue est requis');
      return;
    }
    if (expectedMode === 'text' && !expectedText.trim()) {
      setError('La sortie attendue ne peut pas être vide');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('input', inputFile);
      if (expectedMode === 'file' && expectedFile) {
        form.append('expected_output', expectedFile);
      } else {
        form.append('expected_output', new Blob([expectedText], { type: 'text/plain' }), 'expected_output.txt');
      }

      const res = await fetch(`/api/challenges/${challengeId}/validation-reference-cases`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to author reference case');
        return;
      }

      setInputFile(null);
      setExpectedFile(null);
      setExpectedText('');
      if (inputRef.current) inputRef.current.value = '';
      if (expectedFileRef.current) expectedFileRef.current.value = '';
      await fetchAll();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          <FileText className="h-3.5 w-3.5" /> Cas de référence à vérité terrain
        </p>
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/40">
          {myCases.length}/{requiredValidations} écrits
        </span>
      </div>

      {quotaReached ? (
        <p className="text-xs text-white/35">
          Vos {requiredValidations} cas de référence sont écrits — la validation peut commencer une fois que le total du challenge atteint ce nombre.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="mb-1 block text-[11px] text-white/40">Entrée connue</label>
            <input
              ref={inputRef}
              type="file"
              onChange={e => setInputFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-white/60 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white/70"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[11px] text-white/40">Sortie attendue</label>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setExpectedMode('text')}
                  className={`rounded px-1.5 py-0.5 ${expectedMode === 'text' ? 'bg-brandCP/20 text-brandCP' : 'text-white/30'}`}
                >
                  Texte
                </button>
                <button
                  type="button"
                  onClick={() => setExpectedMode('file')}
                  className={`rounded px-1.5 py-0.5 ${expectedMode === 'file' ? 'bg-brandCP/20 text-brandCP' : 'text-white/30'}`}
                >
                  Fichier
                </button>
              </div>
            </div>
            {expectedMode === 'text' ? (
              <textarea
                value={expectedText}
                onChange={e => setExpectedText(e.target.value)}
                placeholder="La réponse correcte pour cette entrée"
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
              />
            ) : (
              <input
                ref={expectedFileRef}
                type="file"
                onChange={e => setExpectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-white/60 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white/70"
              />
            )}
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brandCP/20 px-3 py-2 text-xs font-medium text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
            Écrire ce cas de référence
          </button>
        </form>
      )}
    </div>
  );
}
