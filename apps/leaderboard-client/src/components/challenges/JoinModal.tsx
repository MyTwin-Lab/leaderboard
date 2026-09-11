'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { useJoinChallenge } from '@/lib/useJoinChallenge';
import { canSelectMore, joinAction, MAX_INVITEES } from '@/lib/joinGate';

interface SearchResult {
  uuid: string;
  full_name: string;
  avatar_url: string | null;
  blocked_reason: 'already_member' | null;
}

/**
 * Rejoindre un challenge, en une seule décision.
 *
 * Rien n'est écrit tant que le bouton n'est pas cliqué : la sélection se
 * construit côté client, et le groupe — donc son jeton — n'est créé qu'au clic.
 * C'est ce qui évite de copier un board et de provisionner une branche juste
 * pour afficher un lien que personne n'utilisera peut-être.
 *
 * Un groupe d'une personne se comporte exactement comme un solo (multiplicateur
 * 1, workspace à soi), mais garde la porte ouverte — ce qu'une participation
 * solo ne fait jamais. Inviter est donc strictement plus sûr que partir seul,
 * et la copie de cet écran ne doit pas laisser croire le contraire.
 */
export function JoinModal({
  challengeId, challengeType, onClose, onJoined,
}: {
  challengeId: string;
  challengeType: string;
  onClose: () => void;
  onJoined: () => Promise<void> | void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const { join, joining, error } = useJoinChallenge(challengeId, onJoined);
  const action = joinAction(selected.length);

  // Recherche débattue : une frappe ne doit pas produire une requête.
  useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/contributors/search?q=${encodeURIComponent(term.trim())}&challenge=${challengeId}`
        );
        const data = res.ok ? await res.json() : { results: [] };
        if (!cancelled) setResults(data.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, challengeId]);

  const add = (person: SearchResult) => {
    if (!canSelectMore(selected.length)) return;
    if (selected.some(s => s.uuid === person.uuid)) return;
    setSelected(prev => [...prev, person]);
    setTerm('');
  };

  const remove = (uuid: string) => setSelected(prev => prev.filter(s => s.uuid !== uuid));

  const submit = async () => {
    const result = await join(action.mode === 'group' ? { mode: 'group' } : {});
    if (!result) return; // `error` est déjà posé par le hook

    if (action.mode === 'solo') { onClose(); return; }

    const token = result.groupId;
    if (!token) { onClose(); return; }

    // Les invitations partent après coup et ne sont pas fatales : le join est
    // déjà commité. Même traitement que les template tasks et le brief du
    // tiroir de création.
    const outcomes = await Promise.all(selected.map(async person => {
      try {
        const res = await fetch(`/api/challenges/${challengeId}/group/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: person.uuid }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }));
    setSentCount(outcomes.filter(Boolean).length);
    setInviteUrl(`${window.location.origin}/challenges/${challengeId}?group=${token}`);
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Presse-papiers refusé (http, permission) — le lien reste sélectionnable
      // à la main, on montre quand même la confirmation.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="animate-pop-in relative w-full max-w-lg rounded-[20px] border border-white/10 bg-background p-6 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/30 transition-colors hover:text-white/60"
        >
          <X className="h-4 w-4" />
        </button>

        {inviteUrl ? (
          /* ── Confirmation : le lien reste utile pour qui n'a pas de compte ── */
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">You&apos;re in</h2>
            <p className="text-xs leading-relaxed text-white/45">
              {sentCount === selected.length
                ? `${sentCount} invitation${sentCount > 1 ? 's' : ''} sent.`
                : `${sentCount} of ${selected.length} invitations sent — share the link with the others.`}
              {' '}They can also join with this link:
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/60">{inviteUrl}</code>
              <button
                onClick={copy}
                aria-label="Copy invite link"
                className="shrink-0 text-white/40 transition-colors hover:text-brandCP"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={onClose}
              style={{ color: '#fff' }}
              className="w-full rounded-full bg-brandCP px-6 py-3 text-sm font-semibold transition-all duration-200 hover:bg-brandCP/90"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Join this challenge</h2>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <input
                value={term}
                onChange={e => setTerm(e.target.value)}
                disabled={!canSelectMore(selected.length)}
                placeholder={canSelectMore(selected.length)
                  ? 'Search contributors to team up with…'
                  : `You can invite up to ${MAX_INVITEES} people`}
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/25 disabled:cursor-not-allowed"
                style={{ color: 'var(--foreground)' }}
              />
              {searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/30" />}
            </div>

            {results.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {results.map(person => {
                  const alreadyPicked = selected.some(s => s.uuid === person.uuid);
                  const blocked = !!person.blocked_reason || alreadyPicked;
                  return (
                    <button
                      key={person.uuid}
                      onClick={() => add(person)}
                      disabled={blocked}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span className="truncate text-sm text-white/80">{person.full_name}</span>
                      {blocked && (
                        <span className="shrink-0 text-[11px] text-white/30">
                          {alreadyPicked ? 'added' : 'already joined'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map(person => (
                  <span
                    key={person.uuid}
                    className="flex items-center gap-1.5 rounded-full bg-brandCP/12 px-3 py-1 text-xs text-brandCP"
                  >
                    {person.full_name}
                    <button
                      onClick={() => remove(person.uuid)}
                      aria-label={`Remove ${person.full_name}`}
                      className="transition-opacity hover:opacity-60"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="text-xs leading-relaxed text-white/45">
                {action.mode === 'group'
                  ? `You and ${selected.length} other${selected.length > 1 ? 's' : ''} — one board, one branch, one contribution, split between you.`
                  : challengeType === 'ml'
                    ? 'Joining adds you to this challenge — you can then submit your dataset and model.'
                    : 'Joining copies the template tasks onto your board and provisions your branch.'}
              </p>
              {/* La bascule solo → groupe est refusée après coup : le board est
                  déjà copié et la branche provisionnée. Le dire ici, où la
                  décision se prend, et nulle part ailleurs. */}
              <p className="text-[11px] text-white/25">
                You cannot switch between solo and group afterwards.
              </p>
            </div>

            <button
              onClick={submit}
              disabled={joining}
              style={{ color: '#fff' }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brandCP px-6 py-3 text-sm font-semibold transition-all duration-200 hover:bg-brandCP/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining
                ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#fff' }} />
                : action.mode === 'group'
                  ? <Users className="h-4 w-4" style={{ color: '#fff' }} />
                  : <UserPlus className="h-4 w-4" style={{ color: '#fff' }} />}
              {action.label}
            </button>

            {error && <p className="text-center text-xs text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
