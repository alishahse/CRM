'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api';

const USER_ID = 1;

const FOLDERS = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'review', label: 'Review' },
  { key: 'spam', label: 'Spam' },
  { key: 'trash', label: 'Trash' },
  { key: 'archive', label: 'Archive' },
];

function initial(name = '?') {
  return (name.trim()[0] || '?').toUpperCase();
}

function formatListDate(value) {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Karachi',
  });
}

function formatFullDate(value) {
  if (!value) return '';
  return new Date(value.replace(' ', 'T')).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Karachi',
  });
}

const emptyCompose = { to_email: '', subject: '', body: '' };

export default function InboxPage() {
  const [folder, setFolder] = useState('inbox');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [payload, setPayload] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState(emptyCompose);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async (opts = {}) => {
    const activeFolder = opts.folder ?? folder;
    const activeQ = opts.q ?? search;
    const activeId = opts.id !== undefined ? opts.id : selectedId;

    setLoading(true);
    setError('');
    try {
      let url = `inbox.php?user_id=${USER_ID}&folder=${activeFolder}`;
      if (activeQ) url += `&q=${encodeURIComponent(activeQ)}`;
      if (activeId) url += `&id=${activeId}`;
      const data = await apiGet(url);
      setPayload(data);
      if (activeId && data.selected) {
        setSelectedId(data.selected.id);
      } else if (!activeId) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [folder, search, selectedId]);

  useEffect(() => {
    load({ id: null });
    setChecked([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search]);

  const messages = payload?.messages || [];
  const selected = payload?.selected || null;
  const counts = payload?.counts || {};
  const mailbox = payload?.mailbox || { name: 'Admin', email: 'admin@crm.local' };

  const allChecked = messages.length > 0 && checked.length === messages.length;

  function toggleAll() {
    setChecked(allChecked ? [] : messages.map((m) => m.id));
  }

  function toggleOne(id) {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function openMessage(id) {
    setSelectedId(id);
    setReplyText('');
    await load({ id });
  }

  async function runBulk(action, extra = {}) {
    if (checked.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await apiPut('inbox.php', {
        user_id: USER_ID,
        action,
        ids: checked,
        ...extra,
      });
      setChecked([]);
      setSelectedId(null);
      await load({ id: null });
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function actOnSelected(action, extra = {}) {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await apiPut('inbox.php', {
        user_id: USER_ID,
        action,
        ids: [selected.id],
        ...extra,
      });
      if (action === 'delete' || action === 'move') {
        setSelectedId(null);
        await load({ id: null });
      } else {
        await load({ id: selected.id });
      }
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendMail(asDraft = false) {
    setBusy(true);
    setError('');
    try {
      await apiPost('inbox.php', {
        user_id: USER_ID,
        action: asDraft ? 'draft' : 'send',
        ...compose,
      });
      setCompose(emptyCompose);
      setComposeOpen(false);
      setFolder(asDraft ? 'drafts' : 'sent');
      setSearch('');
      setQ('');
    } catch (err) {
      setError(err.message || 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiPost('inbox.php', {
        user_id: USER_ID,
        action: 'reply',
        to_email: selected.from_email,
        to_name: selected.from_name,
        subject: selected.subject.startsWith('Re:')
          ? selected.subject
          : `Re: ${selected.subject}`,
        body: replyText.trim(),
        reply_to_id: selected.id,
      });
      setReplyText('');
      setFolder('sent');
      setSearch('');
      setQ('');
    } catch (err) {
      setError(err.message || 'Reply failed');
    } finally {
      setBusy(false);
    }
  }

  const folderTitle = useMemo(
    () => FOLDERS.find((f) => f.key === folder)?.label || 'Inbox',
    [folder]
  );

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] min-h-[560px] overflow-hidden bg-white">
      {/* Mail folders */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              setCompose(emptyCompose);
              setComposeOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ✈ Send
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2">
          {FOLDERS.map((f) => {
            const active = folder === f.key;
            const count = counts[f.key] || 0;
            const showBadge = count > 0 && (f.key === 'sent' || f.key === 'trash' || f.key === 'drafts');

            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFolder(f.key);
                  setSelectedId(null);
                  setChecked([]);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{f.label}</span>
                {showBadge ? (
                  <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Your inbox
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">{mailbox.email}</p>
        </div>
      </aside>

      {/* Message list */}
      <section className="flex w-[380px] shrink-0 flex-col border-r border-slate-200">
        <div className="border-b border-slate-200 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search mail"
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </form>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {folderTitle}
          </h2>
          <button
            type="button"
            onClick={() => load({ id: selectedId })}
            className="text-xs text-slate-500 hover:text-slate-800"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {checked.length > 0 ? (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span className="font-medium">{checked.length} selected</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => runBulk('move', { folder: 'archive' })}
              className="underline"
            >
              Archive
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runBulk('delete')}
              className="underline"
            >
              Delete
            </button>
            <button type="button" onClick={() => setChecked([])} className="ml-auto">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <span className="text-xs text-slate-400">Select all</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && !payload ? (
            <p className="p-4 text-sm text-slate-400">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No messages.</p>
          ) : (
            <ul>
              {messages.map((msg) => {
                const active = selectedId === msg.id;
                const unread = msg.is_read === 0;

                return (
                  <li
                    key={msg.id}
                    className={`flex gap-2 border-b border-slate-100 px-3 py-3 ${
                      active ? 'bg-blue-50' : unread ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked.includes(msg.id)}
                      onChange={() => toggleOne(msg.id)}
                      className="mt-2"
                    />
                    <button
                      type="button"
                      onClick={() => openMessage(msg.id)}
                      className="flex min-w-0 flex-1 gap-2 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                        {initial(folder === 'sent' ? msg.to_name || msg.to_email : msg.from_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`truncate text-sm ${
                              unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                            }`}
                          >
                            {folder === 'sent'
                              ? msg.to_name || msg.to_email
                              : msg.from_name}
                            {msg.thread_count > 1 ? (
                              <span className="ml-1 rounded bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
                                {msg.thread_count}
                              </span>
                            ) : null}
                          </p>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatListDate(msg.created_at)}
                          </span>
                        </div>
                        <p
                          className={`truncate text-xs ${
                            unread ? 'font-semibold text-slate-800' : 'text-slate-500'
                          }`}
                        >
                          {msg.subject}
                        </p>
                        <p className="truncate text-xs text-slate-400">{msg.preview}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Detail */}
      <section className="flex min-w-0 flex-1 flex-col">
        {error ? (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Select a message to read
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">{selected.subject}</h3>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCompose({
                      to_email: selected.from_email,
                      subject: selected.subject.startsWith('Re:')
                        ? selected.subject
                        : `Re: ${selected.subject}`,
                      body: '',
                    });
                    setComposeOpen(true);
                  }}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Reply
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => actOnSelected('move', { folder: 'archive' })}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Archive
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => actOnSelected('delete')}
                  className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-800">{selected.from_name}</span>{' '}
                <span className="text-slate-400">&lt;{selected.from_email}&gt;</span>
              </p>
              <p className="text-xs text-slate-400">
                To: {selected.to_email} · {formatFullDate(selected.created_at)}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                {selected.body}
              </pre>
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${selected.from_name}…`}
                  className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !replyText.trim()}
                  onClick={sendReply}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Compose modal */}
      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-6 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">New message</h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="text-slate-500"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-4">
              <input
                value={compose.to_email}
                onChange={(e) => setCompose((c) => ({ ...c, to_email: e.target.value }))}
                placeholder="To (email)"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <input
                value={compose.subject}
                onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                placeholder="Subject"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <textarea
                value={compose.body}
                onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                placeholder="Write your message…"
                rows={8}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => sendMail(true)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => sendMail(false)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
