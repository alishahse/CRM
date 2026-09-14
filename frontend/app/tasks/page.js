'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiDelete, apiGet, apiPut } from '@/lib/api';

const FILTERS = [
  { key: 'all', label: 'All Tasks', tone: 'blue', icon: '☰' },
  { key: 'active', label: 'Active', tone: 'sky', icon: '▶' },
  { key: 'observation', label: 'Observation', tone: 'violet', icon: '◉' },
  { key: 'completed', label: 'Completed', tone: 'emerald', icon: '✓' },
];

const toneBox = {
  blue: 'bg-blue-50 text-blue-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
};

const statusBadge = {
  new: 'bg-slate-100 text-slate-700',
  active: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-amber-100 text-amber-800',
  observation: 'bg-violet-100 text-violet-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

function statusLabel(s) {
  return String(s || '').replaceAll('_', ' ');
}

function formatSeconds(total) {
  const s = Math.max(0, Math.floor(total || 0));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export default function TasksPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = `tasks.php?filter=${filter}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      const data = await apiGet(url);
      const loadedAt = Math.floor(Date.now() / 1000);
      data.tasks = (data.tasks || []).map((t) => ({
        ...t,
        _baseSpent: t.time_spent || 0,
        _loadedAt: loadedAt,
      }));
      setPayload(data);
      setNowSec(loadedAt);
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  function spentSeconds(t) {
    if (!t.timer_running) return t._baseSpent || 0;
    return (t._baseSpent || 0) + Math.max(0, nowSec - (t._loadedAt || nowSec));
  }

  async function removeTask(id) {
    if (!window.confirm('Delete this task permanently?')) return;
    setBusyId(id);
    setError('');
    try {
      await apiDelete('tasks.php', { id });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTimer(task, action) {
    setBusyId(task.id);
    setError('');
    try {
      const updated = await apiPut('tasks.php', {
        id: task.id,
        timer_action: action,
      });
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  ...updated,
                  _baseSpent: updated.time_spent || 0,
                  _loadedAt: Math.floor(Date.now() / 1000),
                }
              : t
          ),
        };
      });
    } catch (err) {
      setError(err.message || 'Failed to update timer');
    } finally {
      setBusyId(null);
    }
  }

  const counts = payload?.counts || {};
  const tasks = payload?.tasks || [];

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">
        Dashboard <span className="text-slate-300">›</span>{' '}
        <span className="font-medium text-slate-700">Tasks</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                active
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <p className={`text-xs font-medium ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                  {f.label}
                </p>
                <p className="mt-1 text-2xl font-semibold">{counts[f.key] ?? 0}</p>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm ${
                  active ? 'bg-white/20 text-white' : toneBox[f.tone]
                }`}
              >
                {f.icon}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <form
          className="flex min-w-[240px] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </form>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Task
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading && !payload ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Est. Time</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/tasks/${t.id}`)}
                      className="cursor-pointer hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{t.title}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${t.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {t.progress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            statusBadge[t.status] || statusBadge.new
                          }`}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.due_date
                          ? new Date(t.due_date.replace(' ', 'T')).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.est_time || '—'}</td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {t.timer_running ? (
                            <button
                              type="button"
                              title="Stop timer"
                              disabled={busyId === t.id}
                              onClick={() => toggleTimer(t, 'stop')}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                                <rect x="7" y="7" width="10" height="10" rx="1.5" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Start timer"
                              disabled={busyId === t.id}
                              onClick={() => toggleTimer(t, 'start')}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                                <path d="M8 5.5v13l11-6.5L8 5.5z" />
                              </svg>
                            </button>
                          )}
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {formatSeconds(spentSeconds(t))}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Delete"
                          disabled={busyId === t.id}
                          onClick={() => removeTask(t.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 disabled:opacity-50"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
