'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import CameraCapture from '@/components/CameraCapture';
import SnapGallery from '@/components/SnapGallery';

const USER_ID = 1;
const TZ = 'Asia/Karachi';

const ACTION_META = {
  clock_in: { label: 'Clock In', color: 'bg-blue-600 hover:bg-blue-700', icon: '→' },
  break_in: { label: 'Break In', color: 'bg-amber-500 hover:bg-amber-600', icon: '⏸' },
  break_out: { label: 'Break Out', color: 'bg-emerald-600 hover:bg-emerald-700', icon: '▶' },
  clock_out: { label: 'Clock Out', color: 'bg-rose-600 hover:bg-rose-700', icon: '⎋' },
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTime(value) {
  if (!value) return null;
  const d = new Date(value.replace(' ', 'T'));
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  });
}

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: TZ,
  });
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${pad(h)}h ${pad(m)}m`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function StatusBadge({ status, lateMinutes }) {
  if (status === 'late' || lateMinutes > 0) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        Late {lateMinutes > 0 ? `${lateMinutes}m` : ''}
      </span>
    );
  }
  if (status === 'leave') {
    return (
      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
        Leave
      </span>
    );
  }
  if (status === 'present') {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        Present
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {status || '—'}
    </span>
  );
}

function Step({ label, time, done, active }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
          done
            ? 'bg-white text-blue-600'
            : active
              ? 'bg-rose-500 text-white'
              : 'bg-blue-500/40 text-white/70'
        }`}
      >
        {done ? '✓' : active ? '→' : '·'}
      </div>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-blue-100">
        {label}
      </p>
      <p className="text-xs text-white/90">{time || '—'}</p>
    </div>
  );
}

export default function AttendancePage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [gallery, setGallery] = useState({ open: false, snaps: [], index: 0 });
  const [nowTick, setNowTick] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet(`attendance.php?user_id=${USER_ID}&month=${month}`);
      setPayload(data);
    } catch (err) {
      setError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = payload?.today;
  const nextAction = today?.next_action || null;

  const liveClock = useMemo(
    () =>
      nowTick.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: TZ,
      }),
    [nowTick]
  );

  const liveDate = useMemo(
    () =>
      nowTick.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: TZ,
      }),
    [nowTick]
  );

  const workingSeconds = useMemo(() => {
    if (!today?.clock_in) return 0;
    if (today.clock_out) return today.work_seconds || 0;

    const start = new Date(today.clock_in.replace(' ', 'T')).getTime();
    let end = nowTick.getTime();
    let breakMs = 0;

    if (today.break_in && today.break_out) {
      breakMs =
        new Date(today.break_out.replace(' ', 'T')).getTime() -
        new Date(today.break_in.replace(' ', 'T')).getTime();
    } else if (today.break_in && !today.break_out) {
      breakMs = end - new Date(today.break_in.replace(' ', 'T')).getTime();
    }

    return Math.max(0, Math.floor((end - start - breakMs) / 1000));
  }, [today, nowTick]);

  function openCameraForAction() {
    if (!nextAction || busy) return;
    setPendingAction(nextAction);
    setCameraOpen(true);
  }

  async function onCapture(imageDataUrl) {
    if (!pendingAction) return;
    setCameraOpen(false);
    setBusy(true);
    setError('');
    try {
      await apiPost('attendance.php', {
        user_id: USER_ID,
        action: pendingAction,
        image: imageDataUrl,
      });
      await load();
    } catch (err) {
      setError(err.message || 'Punch failed');
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  const actionMeta = nextAction ? ACTION_META[nextAction] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Today's Attendance */}
      <section className="overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
              Today&apos;s Attendance
            </p>
            <p className="mt-1 text-sm text-blue-50">{liveDate}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold tabular-nums">{liveClock}</p>
            <p className="text-xs text-blue-100">{TZ}</p>
          </div>
        </div>

        <div className="mt-6 flex items-start justify-between gap-2 px-4">
          <Step
            label="Clock In"
            time={formatTime(today?.clock_in)}
            done={Boolean(today?.clock_in)}
            active={nextAction === 'clock_in'}
          />
          <div className="mt-4 h-0.5 flex-1 bg-blue-400/50" />
          <Step
            label="Break In"
            time={formatTime(today?.break_in)}
            done={Boolean(today?.break_in)}
            active={nextAction === 'break_in'}
          />
          <div className="mt-4 h-0.5 flex-1 bg-blue-400/50" />
          <Step
            label="Break Out"
            time={formatTime(today?.break_out)}
            done={Boolean(today?.break_out)}
            active={nextAction === 'break_out'}
          />
          <div className="mt-4 h-0.5 flex-1 bg-blue-400/50" />
          <Step
            label="Clock Out"
            time={formatTime(today?.clock_out)}
            done={Boolean(today?.clock_out)}
            active={nextAction === 'clock_out'}
          />
        </div>

        <div className="mt-8 px-5 text-center">
          <p className="font-mono text-4xl font-bold tracking-tight">
            {formatDuration(workingSeconds)}
          </p>
          <p className="mt-1 text-sm text-blue-100">
            {today?.clock_out
              ? 'Day complete'
              : today?.clock_in
                ? today?.break_in && !today?.break_out
                  ? 'On break…'
                  : 'Working…'
                : 'Not started'}
          </p>
        </div>

        <div className="p-5">
          {actionMeta ? (
            <button
              type="button"
              disabled={busy || loading}
              onClick={openCameraForAction}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${actionMeta.color}`}
            >
              <span>{actionMeta.icon}</span>
              {busy ? 'Saving…' : actionMeta.label}
            </button>
          ) : (
            <div className="rounded-lg bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm">
              All punches done for today
            </div>
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* History */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-600"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-800">{monthLabel(month)}</p>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-600"
            >
              ›
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span>
              Work Days:{' '}
              <strong className="text-slate-800">{payload?.summary?.work_days ?? 0}</strong>
            </span>
            <span>
              Late: <strong className="text-slate-800">{payload?.summary?.late ?? 0}</strong>
            </span>
            <span>
              Total Hours:{' '}
              <strong className="text-slate-800">
                {payload?.summary?.total_hours ?? '00h 00m'}
              </strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading && !payload ? (
            <p className="p-4 text-sm text-slate-500">Loading…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Clock In</th>
                  <th className="px-4 py-3 font-medium">Break In</th>
                  <th className="px-4 py-3 font-medium">Break Out</th>
                  <th className="px-4 py-3 font-medium">Clock Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Snap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payload?.history || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No attendance records this month.
                    </td>
                  </tr>
                ) : (
                  payload.history.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                        {formatDay(row.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          {row.clock_in && row.late_minutes === 0 ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          ) : null}
                          <span>{formatTime(row.clock_in) || '—'}</span>
                          {row.late_minutes > 0 ? (
                            <span className="text-xs font-medium text-rose-600">
                              +{row.late_minutes}m
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatTime(row.break_in) || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatTime(row.break_out) || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatTime(row.clock_out) || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                        {row.hours}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} lateMinutes={row.late_minutes} />
                      </td>
                      <td className="px-4 py-3">
                        {row.snap_count > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setGallery({ open: true, snaps: row.snaps, index: 0 })
                            }
                            className="relative inline-block cursor-pointer"
                            title="View snaps"
                          >
                            <img
                              src={row.snaps[0]?.url}
                              alt="snap"
                              className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-200"
                            />
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                              {row.snap_count}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <CameraCapture
        open={cameraOpen}
        actionLabel={pendingAction ? ACTION_META[pendingAction].label : ''}
        onCapture={onCapture}
        onClose={() => {
          setCameraOpen(false);
          setPendingAction(null);
        }}
      />

      <SnapGallery
        open={gallery.open}
        snaps={gallery.snaps}
        startIndex={gallery.index}
        onClose={() => setGallery({ open: false, snaps: [], index: 0 })}
      />
    </div>
  );
}
