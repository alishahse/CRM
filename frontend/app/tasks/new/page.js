'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import TaskForm, { emptyTaskForm } from '@/components/TaskForm';

const USER_ID = 1;

export default function NewTaskPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(form) {
    setSaving(true);
    setError('');
    try {
      await apiPost('tasks.php', {
        ...form,
        created_by: USER_ID,
        project: form.project || null,
        est_time: form.est_time || null,
        due_date: form.due_date || null,
      });
      router.push('/tasks');
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">
            Tasks <span className="text-slate-300">›</span>{' '}
            <span className="font-medium text-slate-700">New Task</span>
          </p>
          <h1 className="text-lg font-semibold text-slate-900">Create Task</h1>
        </div>
        <Link
          href="/tasks"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          ← Back
        </Link>
      </div>

      <TaskForm
        mode="create"
        initial={emptyTaskForm}
        initialSeconds={0}
        timerRunning
        saving={saving}
        error={error}
        onSubmit={onSubmit}
      />
    </div>
  );
}
