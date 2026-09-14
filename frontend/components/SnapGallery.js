'use client';

import { useEffect, useMemo, useState } from 'react';

const ACTION_LABELS = {
  clock_in: 'Clock In',
  break_in: 'Break In',
  break_out: 'Break Out',
  clock_out: 'Clock Out',
};

function formatSnapTime(value) {
  if (!value) return '';
  return new Date(value.replace(' ', 'T')).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Karachi',
  });
}

export default function SnapGallery({ open, snaps, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return undefined;

    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, snaps.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, snaps.length, onClose]);

  const current = snaps[index];
  const title = useMemo(
    () => (current ? ACTION_LABELS[current.action] || current.action : ''),
    [current]
  );

  if (!open || !current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
              Image {index + 1} of {snaps.length}
              {current.created_at ? ` • ${formatSnapTime(current.created_at)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="relative bg-slate-100 px-12 py-6">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-slate-700 shadow disabled:opacity-30"
          >
            ‹
          </button>

          <img
            src={current.url}
            alt={title}
            className="mx-auto max-h-[55vh] w-auto rounded-lg object-contain shadow"
          />

          <button
            type="button"
            disabled={index >= snaps.length - 1}
            onClick={() => setIndex((i) => i + 1)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-slate-700 shadow disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="flex justify-center gap-2 border-t border-slate-200 bg-white px-4 py-3">
          {snaps.map((snap, i) => (
            <button
              key={snap.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-14 w-14 overflow-hidden rounded-md border-2 ${
                i === index ? 'border-blue-600' : 'border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              <img src={snap.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
