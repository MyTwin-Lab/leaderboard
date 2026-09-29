'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';
import { useJoinChallenge } from '@/lib/useJoinChallenge';
import { canSelectMore, joinAction, MAX_INVITEES } from '@/lib/joinGate';
import { challengeInvitePath } from '@/lib/paths';

import './challenge-overlays-vitrine.css';

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
 *
 * Sur la modale du design vitrine : le parent la monte quand elle doit
 * s'ouvrir, elle est donc toujours `open`.
 */
export function JoinModal({
  challengeId, challengeSlug, challengeType, onClose, onJoined,
}: {
  /** Pour les routes d'API. */
  challengeId: string;
  /** Pour le lien d'invitation, qui mène à la page du challenge. */
  challengeSlug: string;
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
    setInviteUrl(`${window.location.origin}${challengeInvitePath(challengeSlug, token)}`);
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

  if (inviteUrl) {
    /* ── Confirmation : le lien reste utile pour qui n'a pas de compte ── */
    return (
      <Modal
        open
        onClose={onClose}
        title="You're in"
        subtitle={
          <>
            {sentCount === selected.length
              ? `${sentCount} invitation${sentCount > 1 ? 's' : ''} sent.`
              : `${sentCount} of ${selected.length} invitations sent - share the link with the others.`}
            {' '}They can also join with this link:
          </>
        }
        icon={<Users />}
        center
      >
        <div className="v-co-link">
          <code>{inviteUrl}</code>
          <button type="button" onClick={copy} aria-label="Copy invite link" className="v-btn-icon">
            {copied ? <Check /> : <Copy />}
          </button>
        </div>
        <button type="button" onClick={onClose} className="v-btn v-co-wide" data-tone="accent">
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Join this challenge" icon={<UserPlus />} center>
      <div className="v-co-search">
        <Search />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          disabled={!canSelectMore(selected.length)}
          placeholder={canSelectMore(selected.length)
            ? 'Search contributors to team up with…'
            : `You can invite up to ${MAX_INVITEES} people`}
          className="v-bare"
        />
        {searching && <Loader2 className="v-spin" />}
      </div>

      {results.length > 0 && (
        <div className="v-co-results">
          {results.map(person => {
            const alreadyPicked = selected.some(s => s.uuid === person.uuid);
            const blocked = !!person.blocked_reason || alreadyPicked;
            return (
              <button
                key={person.uuid}
                type="button"
                onClick={() => add(person)}
                disabled={blocked}
                className="v-co-result"
              >
                <span className="v-co-result-name">{person.full_name}</span>
                {blocked && (
                  <span className="v-co-result-note">
                    {alreadyPicked ? 'added' : 'already joined'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="v-co-chips">
          {selected.map(person => (
            <span key={person.uuid} className="v-co-chip">
              {person.full_name}
              <button type="button" onClick={() => remove(person.uuid)} aria-label={`Remove ${person.full_name}`}>
                <X />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="v-note">
        <p>
          {action.mode === 'group'
            ? `You and ${selected.length} other${selected.length > 1 ? 's' : ''} - one board, one branch, one contribution, split between you.`
            : challengeType === 'ml'
              ? 'Joining adds you to this challenge - you can then submit your dataset and model.'
              : 'Joining copies the template tasks onto your board and provisions your branch.'}
        </p>
        {/* La bascule solo → groupe est refusée après coup : le board est
            déjà copié et la branche provisionnée. Le dire ici, où la
            décision se prend, et nulle part ailleurs. */}
        <p className="v-help" data-size="xs">
          You cannot switch between solo and group afterwards.
        </p>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={joining}
        className="v-btn v-co-wide"
        data-tone="accent"
      >
        {joining
          ? <Loader2 className="v-spin" />
          : action.mode === 'group'
            ? <Users />
            : <UserPlus />}
        {action.label}
      </button>

      {error && <p className="v-field-error v-co-centered">{error}</p>}
    </Modal>
  );
}
