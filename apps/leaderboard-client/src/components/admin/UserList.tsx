'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { User } from '../../../../../packages/database-service/domain/entities';

interface UserListProps {
  users: User[];
  onChangeRole: (userId: string, newRole: string) => void;
  onDelete: (id: string) => void;
}

export function UserList({ users, onChangeRole, onDelete }: UserListProps) {
  const columns = [
    {
      key: 'github_username',
      header: 'GitHub Username',
      render: (user: User) => (
        <div className="font-medium">{user.github_username}</div>
      ),
    },
    {
      key: 'full_name',
      header: 'Full Name',
      render: (user: User) => (
        <div className="text-white/80">{user.full_name}</div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => (
        <select
          value={user.role}
          onChange={(e) => onChangeRole(user.uuid, e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="admin">Admin</option>
          <option value="contributor">Contributor</option>
          <option value="viewer">Viewer</option>
        </select>
      ),
      width: '150px',
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (user: User) => (
        <div className="text-sm text-white/60">
          {new Date(user.created_at).toLocaleDateString()}
        </div>
      ),
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: User) => (
        <Button size="sm" variant="danger" onClick={() => onDelete(user.uuid)}>
          Delete
        </Button>
      ),
      width: '100px',
    },
  ];

  return <Table data={users} columns={columns} emptyMessage="No users found" />;
}
