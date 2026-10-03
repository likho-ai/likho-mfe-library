import type { RecordingStatus as ApiStatus } from '@likho-ai/web-sdk';

/** API statuses mapped to the five chips of the design system, with the words shown. */
export const CHIP: Record<
  ApiStatus,
  { chip: 'new' | 'queued' | 'transcribing' | 'done' | 'failed'; label: string }
> = {
  uploading: { chip: 'new', label: 'Uploading' },
  uploaded: { chip: 'new', label: 'Checking' },
  ready: { chip: 'new', label: 'Ready' },
  queued: { chip: 'queued', label: 'Queued' },
  transcribing: { chip: 'transcribing', label: 'Transcribing' },
  done: { chip: 'done', label: 'Done' },
  failed: { chip: 'failed', label: 'Failed' },
};

export function clock(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  const hours = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function when(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const minutes = Math.round((now - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const LANGUAGES: Record<string, string> = {
  hi: 'Hindi',
  ur: 'Urdu',
  en: 'English',
  mr: 'Marathi',
  pa: 'Punjabi',
};
export function languageName(code: string): string {
  return LANGUAGES[code] ?? code;
}
