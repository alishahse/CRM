'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import StatCard from '@/components/cards/StatCard';
import { IconAttendance, IconInbox, IconMeetings } from '@/components/icons';

const USER_ID = 1;

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T')).toLocaleString();
}

function SectionTitle({ icon, title, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  };

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone] || tones.slate}`}
      >
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet(`dashboard.php?user_id=${USER_ID}`);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button type="button" onClick={load} className="ml-3 underline">
          Retry
        </button>
      </div>
    );
  }

  const att = data.today_attendance;
  const attendanceHint = att?.clock_in
    ? att.clock_out
      ? 'Clocked out'
      : `In since ${att.clock_in}`
    : 'Not clocked in';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Today attendance"
          value={att?.clock_in ? (att.status === 'late' ? 'Late' : 'Present') : 'Absent'}
          hint={attendanceHint}
          tone="emerald"
          icon={<IconAttendance />}
        />
        <StatCard
          label="Unread inbox"
          value={data.unread_inbox}
          hint="Messages waiting"
          tone="blue"
          icon={<IconInbox />}
        />
        <StatCard
          label="Upcoming meetings"
          value={data.upcoming_meetings}
          hint="Scheduled from now"
          tone="violet"
          icon={<IconMeetings />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle
              title="Recent inbox"
              tone="blue"
              icon={<IconInbox className="h-4 w-4" />}
            />
            <Link href="/inbox" className="text-xs font-medium text-slate-600 hover:text-slate-900">
              View all
            </Link>
          </div>
          {data.recent_inbox.length === 0 ? (
            <p className="text-sm text-slate-400">No messages yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_inbox.map((item) => (
                <li key={item.id} className="py-2">
                  <p className="text-sm font-medium text-slate-800">{item.subject}</p>
                  <p className="truncate text-xs text-slate-500">{item.preview || item.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle
              title="Next meetings"
              tone="violet"
              icon={<IconMeetings className="h-4 w-4" />}
            />
            <Link
              href="/meetings"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all
            </Link>
          </div>
          {data.next_meetings.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming meetings.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.next_meetings.map((item) => (
                <li key={item.id} className="py-2">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(item.meeting_date)}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
