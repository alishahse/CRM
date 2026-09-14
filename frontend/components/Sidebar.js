'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/meetings', label: 'Meetings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          CRM
        </p>
        <h1 className="mt-1 text-lg font-semibold text-white">Workspace</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map((link) => {
          const active =
            link.href === '/'
              ? pathname === '/'
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
