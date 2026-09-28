'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { UserList, type ManagedUser, type QualificationOption } from '@/components/admin/UserList';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Search } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [qualifications, setQualifications] = useState<QualificationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [usersRes, qualificationsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/qualifications'),
      ]);
      setUsers(await usersRes.json());
      // Sans la liste des qualifications, les comptes restent gérables : seules
      // les puces d'octroi manquent.
      if (qualificationsRes.ok) setQualifications(await qualificationsRes.json());
    } catch {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete User',
      message: 'This will permanently delete the user and all their data. Are you sure?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.uuid !== id));
        toast('User deleted', 'success');
      } else {
        toast('Failed to delete user', 'error');
      }
    } catch {
      toast('Failed to delete user', 'error');
    }
  };

  const handleRoleUpdated = (updated: ManagedUser) => {
    setUsers((prev) => prev.map((u) => (u.uuid === updated.uuid ? updated : u)));
  };

  const handleQualificationsUpdated = (userId: string, keys: string[]) => {
    setUsers((prev) => prev.map((u) => (u.uuid === userId ? { ...u, qualifications: keys } : u)));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.github_username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        (u.qualifications ?? []).some((key) => key.toLowerCase().includes(q)),
    );
  }, [users, search]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card
        title="Users"
        count={filtered.length !== users.length ? filtered.length : users.length}
        action={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brandCP"
            />
          </div>
        }
      >
        <UserList
          users={filtered}
          qualifications={qualifications}
          onDelete={handleDelete}
          onRoleUpdated={handleRoleUpdated}
          onQualificationsUpdated={handleQualificationsUpdated}
        />
      </Card>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 rounded-md bg-white/5" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-white/5" />
      ))}
    </div>
  );
}
