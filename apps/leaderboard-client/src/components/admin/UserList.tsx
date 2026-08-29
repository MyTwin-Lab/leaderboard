'use client';

import { useState, useRef, useEffect } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Trash2, Loader2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { useToast } from '@/components/ui/Toast';
import type { User } from '../../../../../packages/database-service/domain/entities';

const ROLES = ['admin', 'contributor', 'viewer', 'medical_pro'];

interface UserListProps {
  users: User[];
  onDelete: (id: string) => void;
  onRoleUpdated: (updated: User) => void;
}

function RoleBadge({ user, onRoleUpdated }: { user: User; onRoleUpdated: (u: User) => void }) {
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
        onRoleUpdated(await res.json());
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

export function UserList({ users, onDelete, onRoleUpdated }: UserListProps) {
  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <InitialsAvatar name={user.full_name || user.github_username || '?'} size={28} />
          <div>
            <div className="font-medium text-white">
              {user.full_name || <span className="text-white/40 italic">—</span>}
            </div>
            <div className="text-xs text-white/40">@{user.github_username}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user: User) => (
        <div className="text-sm text-white/50">
          {user.email || <span className="text-white/20 italic">—</span>}
        </div>
      ),
    },
    {
      key: 'google',
      header: 'Google',
      render: (user: User) => (
        <div className="text-xs">
          {user.google_user_id
            ? <span className="text-green-400/70">✓ linked</span>
            : <span className="text-white/20">—</span>}
        </div>
      ),
      width: '90px',
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => <RoleBadge user={user} onRoleUpdated={onRoleUpdated} />,
      width: '130px',
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (user: User) => (
        <div className="text-sm text-white/50">
          {new Date(user.created_at).toLocaleDateString('fr-FR')}
        </div>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: '',
      render: (user: User) => (
        <Button size="sm" variant="danger" onClick={() => onDelete(user.uuid)} title="Delete user">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
      width: '60px',
    },
  ];

  return <Table data={users} columns={columns} emptyMessage="No users found" />;
}
