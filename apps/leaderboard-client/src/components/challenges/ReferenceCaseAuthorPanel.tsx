'use client';

import { flowConfigView } from '@/lib/flowConfig';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flowActionUrl } from '@/lib/challengeActions';
import { FilePlus2, Loader2, AlertCircle, FileText, Upload, X } from 'lucide-react';
import { VitrineEmbed } from '@/components/vitrine/VitrineEmbed';

import './challenge-overlays-vitrine.css';

interface CaseSummary {
  id: string;
  inputFilename: string;
  createdAt: string;
}

/** L'input de fichier natif, habillé en zone pointillée (`.v-co-file`). */
function FilePicker({
  inputRef, file, onChange, placeholder,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  onChange: (file: File | null) => void;
  placeholder: string;
}) {
  return (
    <div className="v-co-file">
      <input
        ref={inputRef}
        type="file"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="v-co-file-box" data-on={file ? 'true' : 'false'}>
        <Upload />
        <span className="v-co-file-name">{file ? file.name : placeholder}</span>
        {file && (
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="v-btn-icon"
            aria-label="Remove file"
          >
            <X />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Contributor-facing, self-gated on the reviewer qualification the challenge
 * requires — a qualified reviewer
 * writes exactly `requiredValidations` ground-truth reference cases for a
 * validation challenge. Renders nothing for anyone else, same as
 * ValidationTargetsEditor renders nothing for a non-manager.
 *
 * Posé dans l'onglet d'un challenge, qui n'est pas une vitrine : le panneau
 * porte sa propre racine (`VitrineEmbed`).
 */
export function ReferenceCaseAuthorPanel({ challengeId }: { challengeId: string }) {
  const [isReviewer, setIsReviewer] = useState(false);
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
        fetch(flowActionUrl(challengeId, 'reference-cases')),
      ]);
      const me = meRes.ok ? await meRes.json() : null;
      if (challengeRes.ok) {
        const challenge = await challengeRes.json();
        const config = flowConfigView(challenge);
        setRequiredValidations(config.required_validations ?? 0);
        // Écrire des cas exige la qualification que le challenge pose.
        const held: string[] = Array.isArray(me?.qualifications) ? me.qualifications : [];
        setIsReviewer(!!config.reviewer_qualification && held.includes(config.reviewer_qualification));
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

  if (loading || !isReviewer) return null;

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

      const res = await fetch(flowActionUrl(challengeId, 'reference-cases'), {
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
    <VitrineEmbed>
      <div className="v-co-rc">
        <div className="v-co-rc-head">
          <div className="flex flex-col gap-0.5">
            <p className="v-co-rc-title">
              <FileText /> Author a reference case
            </p>
            <p className="v-help">
              Ground-truth input + expected output. Validators claim your cases blind -
              {' '}{myCases.length} authored{quotaReached ? '' : `, ${requiredValidations - myCases.length} pending`}.
            </p>
          </div>
          {!quotaReached && (
            <button type="button" onClick={() => setFormOpen(o => !o)} className="v-btn-quiet v-btn-sm">
              {formOpen ? 'Cancel' : 'New case'}
            </button>
          )}
        </div>

        {quotaReached ? (
          <p className="v-help">
            Your {requiredValidations} reference cases are written - validation can start once the challenge total reaches this number.
          </p>
        ) : formOpen && (
          <form onSubmit={handleSubmit} className="v-form v-co-rc-form">
            <div className="v-field">
              <span className="v-label">Known input</span>
              <FilePicker
                inputRef={inputRef}
                file={inputFile}
                onChange={f => setInputFile(f)}
                placeholder="Choose an input file"
              />
            </div>

            <div className="v-field">
              <div className="flex items-center justify-between gap-2">
                <span className="v-label">Expected output</span>
                <div className="v-co-seg">
                  <button
                    type="button"
                    onClick={() => setExpectedMode('text')}
                    className="v-co-seg-btn"
                    data-on={expectedMode === 'text' ? 'true' : 'false'}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpectedMode('file')}
                    className="v-co-seg-btn"
                    data-on={expectedMode === 'file' ? 'true' : 'false'}
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
                  className="v-textarea"
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
              <div className="v-alert">
                <AlertCircle />
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="v-btn v-co-wide" data-tone="accent">
              {submitting ? <Loader2 className="v-spin" /> : <FilePlus2 />}
              Write this reference case
            </button>
          </form>
        )}
      </div>
    </VitrineEmbed>
  );
}
