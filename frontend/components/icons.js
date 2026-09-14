export function IconAttendance({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8" strokeLinecap="round" />
      <path d="M16.5 7.5 18 9l3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconInbox({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8.5 12 3l8 5.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8.5Z" strokeLinejoin="round" />
      <path d="M4 9h5.2a2.8 2.8 0 0 0 5.6 0H20" strokeLinecap="round" />
    </svg>
  );
}

export function IconMeetings({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" strokeLinecap="round" />
      <path d="M8 14h3M13 14h3M8 17h8" strokeLinecap="round" />
    </svg>
  );
}
