'use client';

import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { User } from '../../../../../packages/database-service/domain/entities';

interface UserListProps {
  users: User[];
  onDelete: (id: string) => void;
}

export function UserList({ users, onDelete }: UserListProps) {
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
        <Badge label={user.role} />
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
