import Link from 'next/link';

export default function AdminPage() {
  const quickActions = [
    {
      title: 'Challenges',
      description: 'Manage challenges, sync with GitHub, and track progress',
      href: '/admin/challenges',
      icon: '🎯',
    },
    {
      title: 'Projects',
      description: 'Create and manage projects and repositories',
      href: '/admin/projects',
      icon: '📁',
    },
    {
      title: 'Users',
      description: 'Manage user roles and permissions',
      href: '/admin/users',
      icon: '👥',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 hover:bg-white/10 hover:border-primary-300/30 transition-all"
            >
              <div className="text-3xl mb-3">{action.icon}</div>
              <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-100 transition-colors">
                {action.title}
              </h4>
              <p className="text-sm text-white/60">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats placeholder */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
        <h3 className="text-lg font-medium text-white mb-4">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-white/5 p-4">
            <div className="text-2xl font-bold text-brandCP mb-1">--</div>
            <div className="text-sm text-white/60">Active Challenges</div>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <div className="text-2xl font-bold text-primary-100 mb-1">--</div>
            <div className="text-sm text-white/60">Total Projects</div>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <div className="text-2xl font-bold text-primary-200 mb-1">--</div>
            <div className="text-sm text-white/60">Registered Users</div>
          </div>
        </div>
      </div>
    </div>
  );
}
