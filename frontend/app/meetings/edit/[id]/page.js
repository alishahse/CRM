'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api';

const emptyForm = {
  title: '',
  description: '',
  meeting_date: '',
  location: '',
  status: 'scheduled',
};

function toLocalInput(value) {
  if (!value) return '';
  return value.replace(' ', 'T').slice(0, 16);
}

export default function EditMeetingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('meetings.php');
      const meeting = (data || []).find((m) => String(m.id) === String(id));
      if (!meeting) {
        setError('Meeting not found');
        return;
      }
      setForm({
        title: meeting.title || '',
        description: meeting.description || '',
        meeting_date: toLocalInput(meeting.meeting_date),
        location: meeting.location || '',
        status: meeting.status || 'scheduled',
      });
    } catch (err) {
      setError(err.message || 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      await apiPut('meetings.php', {
        id: Number(id),
        ...form,
      });
      router.push('/meetings');
    } catch (err) {
      setError(err.message || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Meetings
          </p>
          <h1 className="text-lg font-semibold text-slate-900">Edit meeting</h1>
        </div>
        <Link
          href="/meetings"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← Back to list
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading meeting…</p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
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
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="scheduled">Scheduled</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
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
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || Boolean(error && !form.title)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Update meeting'}
            </button>
            <Link
              href="/meetings"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
