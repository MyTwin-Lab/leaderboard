'use client';

import { useState, useRef, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Trash2, Loader2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { useToast } from '@/components/ui/Toast';
import type { User } from '../../../../../packages/database-service/domain/entities';

/** Des permissions, rien d'autre : une compétence reconnue se gère à part, en qualification. */
const ROLES = ['admin', 'contributor', 'viewer'];

/** Un compte tel que `GET /api/users` le renvoie : avec les clés de ses qualifications. */
export interface ManagedUser extends User {
  qualifications?: string[];
}

/** Une qualification que la distribution déclare (`GET /api/qualifications`). */
export interface QualificationOption {
  key: string;
  label: string;
  description: string | null;
}

interface UserListProps {
  users: ManagedUser[];
  qualifications: QualificationOption[];
  onDelete: (id: string) => void;
  onRoleUpdated: (updated: ManagedUser) => void;
  onQualificationsUpdated: (userId: string, keys: string[]) => void;
}

function RoleBadge({ user, onRoleUpdated }: { user: ManagedUser; onRoleUpdated: (u: ManagedUser) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (role: string) => {
    if (role === user.role) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/users/${user.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        onRoleUpdated({ ...(await res.json()), qualifications: user.qualifications });
        toast('Role updated', 'success');
      } else {
        toast('Failed to update role', 'error');
      }
    } catch {
      toast('Failed to update role', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full transition-opacity hover:opacity-70 focus:outline-none"
        title="Click to change role"
        disabled={saving}
      >
        {saving
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
          : <Badge label={user.role} />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[130px] rounded-lg border border-white/10 bg-[#0f0f1a] py-1 shadow-xl">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => handleSelect(r)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-white/5 ${
                r === user.role ? 'text-brandCP' : 'text-white/70'
              }`}
            >
              <Badge label={r} />
              {r === user.role && <span className="ml-auto text-xs text-brandCP">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Les qualifications d'un compte, une puce par qualification déclarée : pleine
 * quand le compte la détient. Un clic octroie ou retire, et le serveur trace le
 * geste. Une clé que la distribution ne déclare plus reste affichée, retirable.
 */
function QualificationToggles({
  user, options, onUpdated,
}: { user: ManagedUser; options: QualificationOption[]; onUpdated: (keys: string[]) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const toast = useToast();
  const held = new Set(user.qualifications ?? []);
  const retired = [...held].filter((key) => !options.some((option) => option.key === key));

  const toggle = async (key: string) => {
    const revoking = held.has(key);
    setPending(key);
    try {
      const res = await fetch(`/api/users/${user.uuid}/qualifications`, {
        method: revoking ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.qualifications ?? []);
        toast(revoking ? 'Qualification revoked' : 'Qualification granted', 'success');
      } else {
        toast(revoking ? 'Failed to revoke qualification' : 'Failed to grant qualification', 'error');
      }
    } catch {
      toast('Failed to update qualification', 'error');
    } finally {
      setPending(null);
    }
  };

  const chip = (key: string, label: string, title: string) => {
    const active = held.has(key);
    return (
      <button
        key={key}
        onClick={() => toggle(key)}
        disabled={pending !== null}
        title={title}
        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
          active
            ? 'border-brandCP/40 bg-brandCP/10 text-brandCP'
            : 'border-white/10 text-white/35 hover:border-white/25 hover:text-white/60'
        }`}
      >
        {pending === key && <Loader2 className="h-3 w-3 animate-spin" />}
        {label}
      </button>
    );
  };

  if (options.length === 0 && retired.length === 0) {
    return <span className="text-xs text-white/20">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) =>
        chip(
          option.key,
          option.label,
          held.has(option.key) ? `Revoke: ${option.description ?? option.label}` : `Grant: ${option.description ?? option.label}`,
        )
      )}
      {retired.map((key) => chip(key, key, 'No longer declared by this platform — click to revoke'))}
    </div>
  );
}

export function UserList({ users, qualifications, onDelete, onRoleUpdated, onQualificationsUpdated }: UserListProps) {
  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (user: ManagedUser) => (
        <div className="flex items-center gap-3">
          <InitialsAvatar name={user.full_name || user.github_username || '?'} size={28} />
          <div>
            <div className="font-medium text-white">
              {user.full_name || <span className="text-white/40 italic">-</span>}
            </div>
            <div className="text-xs text-white/40">@{user.github_username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user: ManagedUser) => (
        <div className="text-sm text-white/50">
          {user.email || <span className="text-white/20 italic">-</span>}
        </div>
      ),
    },
    {
      key: 'google',
      header: 'Google',
      render: (user: ManagedUser) => (
        <div className="text-xs">
          {user.google_user_id
            ? <span className="text-green-400/70">✓ linked</span>
            : <span className="text-white/20">-</span>}
        </div>
      ),
      width: '90px',
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: ManagedUser) => <RoleBadge user={user} onRoleUpdated={onRoleUpdated} />,
      width: '130px',
    },
    {
      key: 'qualifications',
      header: 'Qualifications',
      render: (user: ManagedUser) => (
        <QualificationToggles
          user={user}
          options={qualifications}
          onUpdated={(keys) => onQualificationsUpdated(user.uuid, keys)}
        />
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (user: ManagedUser) => (
        <div className="text-sm text-white/50">
          {new Date(user.created_at).toLocaleDateString('fr-FR')}
        </div>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: '',
      render: (user: ManagedUser) => (
        <Button size="sm" variant="danger" onClick={() => onDelete(user.uuid)} title="Delete user">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
      width: '60px',
    },
  ];

  return <Table data={users} columns={columns} emptyMessage="No users found" />;
}
