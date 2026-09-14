'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';

const USER_ID = 1;

const emptyForm = {
  title: '',
  description: '',
  meeting_date: '',
  location: '',
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T')).toLocaleString();
}

function IconButton({ title, onClick, className, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4h8v2" strokeLinecap="round" />
      <path d="M19 6l-1 14H6L5 6" strokeLinejoin="round" />
    </svg>
  );
}

function IconCancel() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('meetings.php');
      setMeetings(data);
    } catch (err) {
      setError(err.message || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('meetings.php', {
        ...form,
        created_by: USER_ID,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    setBusyId(id);
    setError('');
    try {
      await apiPut('meetings.php', { id, status });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  }

  async function removeMeeting(id) {
    if (!window.confirm('Delete this meeting permanently?')) return;
    setBusyId(id);
    setError('');
    try {
      await apiDelete('meetings.php', { id });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to delete meeting');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-900">New meeting</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Title</span>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Location</span>
            <input
              name="location"
              value={form.location}
              onChange={onChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Date & time</span>
            <input
              type="datetime-local"
              name="meeting_date"
              value={form.meeting_date}
              onChange={onChange}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Create meeting'}
        </button>
      </form>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-400">
                    No meetings yet.
                  </td>
                </tr>
              ) : (
                meetings.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{m.title}</td>
                    <td className="px-4 py-3">{formatDateTime(m.meeting_date)}</td>
                    <td className="px-4 py-3">{m.location || '—'}</td>
                    <td className="px-4 py-3 capitalize">{m.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-nowrap items-center gap-3">
                        {m.status !== 'done' ? (
                          <IconButton
                            title="Done"
                            disabled={busyId === m.id}
                            onClick={() => updateStatus(m.id, 'done')}
                            className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                          >
                            <IconCheck />
                          </IconButton>
                        ) : null}

                        <IconButton
                          title="Edit"
                          disabled={busyId === m.id}
                          onClick={() => router.push(`/meetings/edit/${m.id}`)}
                          className="border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <IconEdit />
                        </IconButton>

                        <IconButton
                          title="Delete"
                          disabled={busyId === m.id}
                          onClick={() => removeMeeting(m.id)}
                          className="border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100"
                        >
                          <IconTrash />
                        </IconButton>

                        {m.status !== 'cancelled' ? (
                          <IconButton
                            title="Cancel"
                            disabled={busyId === m.id}
                            onClick={() => updateStatus(m.id, 'cancelled')}
                            className="border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
                          >
                            <IconCancel />
                          </IconButton>
                        ) : null}
                      </div>
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
