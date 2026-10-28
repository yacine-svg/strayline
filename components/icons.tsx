interface IconProps {
  className?: string;
}

/** Two road edges converging on the horizon, with the centre dashes between them. */
export function Logo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 16" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M2 15 8.4 1.5M18 15 11.6 1.5" strokeWidth="1.8" />
      <path d="M10 14.2v-3.4" strokeWidth="2" />
      <path d="M10 8.2V5.9" strokeWidth="1.6" />
      <path d="M10 3.8v-1" strokeWidth="1.2" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" />
    </svg>
  );
}

export function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {open ? <path d="M5 5l10 10M15 5 5 15" /> : <path d="M3.5 7.5h13M3.5 12.5h13" />}
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="currentColor">
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="currentColor">
      <path d="M4.5 2.8v10.4a.8.8 0 0 0 1.2.7l8.3-5.2a.8.8 0 0 0 0-1.4L5.7 2.1a.8.8 0 0 0-1.2.7z" />
    </svg>
  );
}
