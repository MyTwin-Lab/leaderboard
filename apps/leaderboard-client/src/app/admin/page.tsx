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
    <div className="space-y-6 sm:space-y-8">
      {/* Quick actions */}
      <div>
        <h3 className="mb-3 text-base font-medium text-white sm:mb-4 sm:text-lg">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all hover:border-brandCP/30 hover:bg-white/10 sm:p-6"
            >
              <div className="mb-2 text-2xl sm:mb-3 sm:text-3xl">{action.icon}</div>
              <h4 className="mb-1 text-base font-semibold text-white transition-colors group-hover:text-brandCP sm:mb-2 sm:text-lg">
                {action.title}
              </h4>
              <p className="text-xs text-white/60 sm:text-sm">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats placeholder */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:rounded-2xl sm:p-6">
        <h3 className="mb-3 text-base font-medium text-white sm:mb-4 sm:text-lg">System Status</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-lg bg-white/5 p-3 sm:p-4">
            <div className="mb-0.5 text-xl font-bold text-brandCP sm:mb-1 sm:text-2xl">--</div>
            <div className="text-xs text-white/60 sm:text-sm">Active Challenges</div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 sm:p-4">
            <div className="mb-0.5 text-xl font-bold text-brandCP/80 sm:mb-1 sm:text-2xl">--</div>
            <div className="text-xs text-white/60 sm:text-sm">Total Projects</div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 sm:p-4">
            <div className="mb-0.5 text-xl font-bold text-brandCP/60 sm:mb-1 sm:text-2xl">--</div>
            <div className="text-xs text-white/60 sm:text-sm">Registered Users</div>
          </div>
        </div>
      </div>
    </div>
  );
}
