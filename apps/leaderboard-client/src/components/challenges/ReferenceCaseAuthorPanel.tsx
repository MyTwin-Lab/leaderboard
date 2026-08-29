'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FilePlus2, Loader2, AlertCircle, FileText, Upload, X } from 'lucide-react';

interface CaseSummary {
  id: string;
  inputFilename: string;
  createdAt: string;
}

/** Native file input dressed up as a dashed dropzone-style button, matching the rest of the redesign. */
function FilePicker({
  inputRef, file, onChange, placeholder,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  onChange: (file: File | null) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div
        className={`flex items-center gap-2.5 rounded-[14px] border border-dashed px-3.5 py-3 text-sm transition-colors ${
          file ? 'border-brandCP/35 bg-brandCP/[0.05] text-white/80' : 'border-white/12 bg-white/[0.02] text-white/35'
        }`}
      >
        <Upload className={`h-4 w-4 shrink-0 ${file ? 'text-brandCP' : 'text-white/25'}`} />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : placeholder}</span>
        {file && (
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="relative z-10 shrink-0 rounded-full p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
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
  const [formOpen, setFormOpen] = useState(false);

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
      setError('An input file is required');
      return;
    }
    if (expectedMode === 'file' && !expectedFile) {
      setError('An expected-output file is required');
      return;
    }
    if (expectedMode === 'text' && !expectedText.trim()) {
      setError('The expected output cannot be empty');
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
      setFormOpen(false);
      await fetchAll();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[20px] border border-dashed border-brandCP/30 bg-brandCP/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <FileText className="h-3.5 w-3.5 text-brandCP/70" /> Author a reference case
          </p>
          <p className="text-xs text-white/40">
            Ground-truth input + expected output. Validators claim your cases blind —
            {' '}{myCases.length} authored{quotaReached ? '' : `, ${requiredValidations - myCases.length} pending`}.
          </p>
        </div>
        {!quotaReached && (
          <button
            onClick={() => setFormOpen(o => !o)}
            style={{ color: '#000' }}
            className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-semibold transition-colors hover:bg-white/90"
          >
            {formOpen ? 'Cancel' : 'New case'}
          </button>
        )}
      </div>

      {quotaReached ? (
        <p className="text-xs text-white/35">
          Your {requiredValidations} reference cases are written — validation can start once the challenge total reaches this number.
        </p>
      ) : formOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-white/[0.07] pt-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Known input</span>
            <FilePicker
              inputRef={inputRef}
              file={inputFile}
              onChange={f => setInputFile(f)}
              placeholder="Choose an input file"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Expected output</span>
              <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.02] p-0.5">
                <button
                  type="button"
                  onClick={() => setExpectedMode('text')}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    expectedMode === 'text' ? 'bg-brandCP/15 text-brandCP' : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setExpectedMode('file')}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    expectedMode === 'file' ? 'bg-brandCP/15 text-brandCP' : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  File
                </button>
              </div>
            </div>
            {expectedMode === 'text' ? (
              <textarea
                value={expectedText}
                onChange={e => setExpectedText(e.target.value)}
                placeholder="The correct answer for this input"
                rows={3}
                className="w-full resize-none rounded-[14px] border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white placeholder:text-white/20 transition-colors focus:border-brandCP/40 focus:outline-none"
              />
            ) : (
              <FilePicker
                inputRef={expectedFileRef}
                file={expectedFile}
                onChange={f => setExpectedFile(f)}
                placeholder="Choose an expected-output file"
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
            style={{ color: '#fff' }}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brandCP px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brandCP/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#fff' }} />
              : <FilePlus2 className="h-3.5 w-3.5" style={{ color: '#fff' }} />}
            Write this reference case
          </button>
        </form>
      )}
    </div>
  );
}
