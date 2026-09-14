'use client';

import { usePathname } from 'next/navigation';

const titles = {
  '/': 'Dashboard',
  '/attendance': 'Attendance',
  '/inbox': 'Inbox',
  '/meetings': 'Meetings',
  '/tasks': 'Tasks',
  '/tasks/new': 'New Task',
};

export default function Navbar() {
  const pathname = usePathname();
  const title = pathname.startsWith('/meetings/edit')
    ? 'Edit Meeting'
    : pathname === '/tasks/new'
      ? 'New Task'
      : pathname.startsWith('/tasks/') && pathname !== '/tasks'
        ? 'Edit Task'
        : titles[pathname] || 'CRM';

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">
        Admin User
      </p>
    </header>
  );
}
