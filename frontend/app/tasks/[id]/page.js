'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api';
import TaskForm, { emptyTaskForm, taskToForm } from '@/components/TaskForm';

export default function EditTaskPage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(emptyTaskForm);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const task = await apiGet(`tasks.php?id=${id}`);
      setInitial(taskToForm(task));
      setSeconds(task.time_spent || 0);
      setRunning(Boolean(task.timer_running));
    } catch (err) {
      setError(err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(form) {
    setSaving(true);
    setError('');
    try {
      await apiPut('tasks.php', {
        id: Number(id),
        ...form,
        project: form.project || null,
        est_time: form.est_time || null,
        due_date: form.due_date || null,
      });
      router.push('/tasks');
    } catch (err) {
      setError(err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  }

  async function onTimerAction(action) {
    setError('');
    try {
      const updated = await apiPut('tasks.php', {
        id: Number(id),
        timer_action: action,
      });
      setSeconds(updated.time_spent || 0);
      setRunning(Boolean(updated.timer_running));
      return updated;
    } catch (err) {
      setError(err.message || 'Failed to update timer');
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">
            Tasks <span className="text-slate-300">›</span>{' '}
            <span className="font-medium text-slate-700">Edit Task</span>
          </p>
          <h1 className="text-lg font-semibold text-slate-900">Task details</h1>
        </div>
        <Link
          href="/tasks"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          ← Back
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading task…</p>
      ) : (
        <TaskForm
          mode="edit"
          initial={initial}
          initialSeconds={seconds}
          timerRunning={running}
          saving={saving}
          error={error}
          onSubmit={onSubmit}
          onTimerAction={onTimerAction}
        />
      )}
    </div>
  );
}
