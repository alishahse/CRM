'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const field =
  'w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white';
const labelCls =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function formatSeconds(total) {
  const s = Math.max(0, Math.floor(total || 0));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function toLocalInput(value) {
  if (!value) return '';
  return value.replace(' ', 'T').slice(0, 16);
}

export const emptyTaskForm = {
  title: '',
  status: 'active',
  type: 'operational',
  priority: 'medium',
  project: '',
  est_time: '',
  due_date: '',
  description: '',
  progress: 0,
};

export function taskToForm(task) {
  return {
    title: task.title || '',
    status: task.status || 'active',
    type: task.type || 'operational',
    priority: task.priority || 'medium',
    project: task.project || '',
    est_time: task.est_time || '',
    due_date: toLocalInput(task.due_date),
    description: task.description || '',
    progress: task.progress ?? 0,
  };
}

export default function TaskForm({
  mode = 'create',
  initial = emptyTaskForm,
  initialSeconds = 0,
  timerRunning = mode === 'create',
  saving = false,
  error = '',
  onSubmit,
  onTimerAction,
  cancelHref = '/tasks',
}) {
  const [form, setForm] = useState(initial);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(Boolean(timerRunning));
  const [timerBusy, setTimerBusy] = useState(false);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    setRunning(Boolean(timerRunning));
  }, [timerRunning]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleTimer(action) {
    if (mode === 'create' || !onTimerAction) {
      if (action === 'stop') setRunning(false);
      else setRunning(true);
      return;
    }
    setTimerBusy(true);
    try {
      const updated = await onTimerAction(action);
      if (updated) {
        setSeconds(updated.time_spent || 0);
        setRunning(Boolean(updated.timer_running));
      }
    } finally {
      setTimerBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className={labelCls}>Title</span>
        <input
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="What needs to be done?"
          className={field}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Status</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={field}>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="in_progress">In Progress</option>
            <option value="observation">Observation</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Type</span>
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className={field}>
            <option value="operational">Operational</option>
            <option value="development">Development</option>
            <option value="bug">Bug</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Priority</span>
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            className={field}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Project</span>
          <input
            value={form.project}
            onChange={(e) => set('project', e.target.value)}
            placeholder="No project"
            className={field}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Est. Time</span>
          <select
            value={form.est_time}
            onChange={(e) => set('est_time', e.target.value)}
            className={field}
          >
            <option value="">Select</option>
            <option value="30m">30m</option>
            <option value="1h">1h</option>
            <option value="2h">2h</option>
            <option value="4h">4h</option>
            <option value="8h">8h</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Due Date</span>
          <input
            type="datetime-local"
            value={form.due_date}
            onChange={(e) => set('due_date', e.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className={labelCls}>Time Tracker</p>
          <div className="mt-2 flex items-center gap-3">
            {running ? (
              <button
                type="button"
                title="Stop timer"
                disabled={timerBusy}
                onClick={() => handleTimer('stop')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm ring-1 ring-slate-200 hover:bg-rose-50 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="1.5" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                title="Start timer"
                disabled={timerBusy}
                onClick={() => handleTimer('start')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M8 5.5v13l11-6.5L8 5.5z" />
                </svg>
              </button>
            )}
            <div>
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900">
                {formatSeconds(seconds)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {running ? 'Running…' : 'Stopped'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm">
            <div>
              <p className="text-[11px] uppercase text-slate-400">Estimated</p>
              <p className="font-medium text-slate-700">{form.est_time || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-400">Spent</p>
              <p className="font-medium text-slate-700">{formatSeconds(seconds)}</p>
            </div>
          </div>
        </div>

        <label className="block">
          <span className={labelCls}>Progress (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={form.progress}
            onChange={(e) => set('progress', Number(e.target.value))}
            className={field}
          />
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, form.progress || 0))}%` }}
            />
          </div>
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Add description"
          className={field}
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Link
          href={cancelHref}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving
            ? 'Saving…'
            : mode === 'edit'
              ? 'Update Task'
              : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
