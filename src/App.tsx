/**
 * The recordings library: every call of the workspace with where it stands, uploads, and the
 * way into each transcript. Exposed to the shell as ./App; mounted at /recordings.
 */
import { Button, StatusChip } from '@likho-ai/ui';
import {
  useCancelJob,
  useCreateJob,
  useMe,
  useRecordingCounts,
  useRecordings,
  useUploader,
  useWorkspaceLive,
  type Recording,
  type RecordingStatus,
} from '@likho-ai/web-sdk';
import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DialerImport } from './components/DialerImport';
import { UploadPanel } from './components/UploadPanel';
import { CHIP, clock, languageName, when } from './lib/format';
import './app.css';

type Filter = 'all' | 'done' | 'transcribing' | 'queued' | 'failed' | 'ready';
const FILTERS: { key: Filter; label: string; statuses?: RecordingStatus[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done', statuses: ['done'] },
  { key: 'transcribing', label: 'Transcribing', statuses: ['transcribing'] },
  { key: 'queued', label: 'Queued', statuses: ['queued'] },
  { key: 'ready', label: 'Ready', statuses: ['ready', 'uploading', 'uploaded'] },
  { key: 'failed', label: 'Failed', statuses: ['failed'] },
];

function Row({
  recording,
  canChange,
}: {
  recording: Recording & {
    jobs: { id: string; status: string; progressSeconds: number; totalSeconds: number }[];
  };
  /** A viewer reads: no Transcribe, no Cancel. */
  canChange: boolean;
}) {
  const createJob = useCreateJob();
  const cancelJob = useCancelJob();
  const chip = CHIP[recording.status];
  const running = recording.jobs.find((job) => job.status === 'running' || job.status === 'queued');
  const progress = running && running.totalSeconds > 0 ? running.progressSeconds / running.totalSeconds : 0;

  return (
    <tr className="border-t border-line">
      <td className="py-3 pr-4">
        <Link to={`/recordings/${recording.id}`} className="font-medium text-ink hover:underline">
          {recording.originalName}
        </Link>
        {recording.externalId && (
          <span className="ml-2 font-mono text-xs text-ink-3">{recording.externalId}</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <StatusChip status={chip.chip} label={chip.label} />
        {recording.status === 'transcribing' && running && (
          <span
            className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-accent-soft"
            aria-hidden="true"
          >
            <span className="block h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        )}
        {recording.status === 'failed' && recording.failureReason && (
          <span className="mt-1 block max-w-xs text-xs text-ink-2">{recording.failureReason}</span>
        )}
      </td>
      <td className="py-3 pr-4 text-ink-2">
        {recording.detectedLanguage
          ? `${languageName(recording.detectedLanguage)} ${Math.round(recording.languageProbability * 100)}%`
          : '—'}
      </td>
      <td className="py-3 pr-4 font-mono text-sm tabular-nums text-ink-2">
        {recording.durationSeconds ? clock(recording.durationSeconds) : '—'}
      </td>
      <td className="py-3 pr-4 text-ink-2">{when(recording.createdAt)}</td>
      <td className="py-3 text-right">
        {recording.status === 'done' && (
          <Button size="sm" asChild>
            <Link to={`/recordings/${recording.id}`}>Open</Link>
          </Button>
        )}
        {recording.status === 'transcribing' && (
          <Button size="sm" asChild>
            <Link to={`/recordings/${recording.id}`}>Watch live</Link>
          </Button>
        )}
        {canChange && recording.status === 'queued' && running && (
          <Button size="sm" variant="ghost" onClick={() => cancelJob.mutate({ id: running.id })}>
            Cancel
          </Button>
        )}
        {canChange && recording.status === 'ready' && (
          <Button size="sm" variant="primary" onClick={() => createJob.mutate({ recordingId: recording.id })}>
            Transcribe
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function App() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const statuses = FILTERS.find((f) => f.key === filter)?.statuses;
  const recordings = useRecordings({ status: statuses ?? null, search: deferredSearch || null });
  const counts = useRecordingCounts();
  const uploader = useUploader();
  const live = useWorkspaceLive();
  const me = useMe();
  // A viewer reads, plays and searches; the ways to change things are not shown to them.
  const canChange = me.data?.role !== 'viewer';
  const showUpload = canChange && params.get('upload') === '1';

  const items = recordings.data?.pages.flatMap((page) => page.items) ?? [];
  const total = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : null;
  const countOf = (key: Filter) => {
    if (!counts.data) return null;
    if (key === 'all') return total;
    const statusesOf = FILTERS.find((f) => f.key === key)?.statuses ?? [];
    return statusesOf.reduce((sum, status) => sum + counts.data![status], 0);
  };

  return (
    <div data-mfe="library" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recordings</h1>
          <p className="mt-1 text-ink-2">
            {total === null ? '…' : `${total} call${total === 1 ? '' : 's'}`}
            {live === 'error' && (
              <span className="ml-2 text-[var(--likho-status-failed-ink)]">(live updates paused)</span>
            )}
          </p>
        </div>
        {canChange && (
          <Button
            variant={showUpload ? 'secondary' : 'primary'}
            onClick={() => setParams(showUpload ? {} : { upload: '1' })}
            aria-expanded={showUpload}
          >
            {showUpload ? 'Hide upload' : 'Upload call'}
          </Button>
        )}
      </div>

      {showUpload && (
        <>
          <UploadPanel items={uploader.items} onFiles={uploader.add} onClear={uploader.clear} />
          <DialerImport />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                filter === f.key ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2'
              }`}
            >
              {f.label}
              {countOf(f.key) !== null && <span className="ml-1.5 text-ink-3">{countOf(f.key)}</span>}
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <span className="sr-only">Search by file name</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file names"
            className="min-h-11 rounded-full border border-line bg-surface pl-9 pr-4 text-sm text-ink focus-visible:outline-accent"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-ink-3">
            <tr>
              <th className="px-6 py-3 font-medium">Recording</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Language</th>
              <th className="py-3 pr-4 font-medium">Length</th>
              <th className="py-3 pr-4 font-medium">Added</th>
              <th className="py-3 pr-6 text-right font-medium">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr>td:first-child]:pl-6 [&>tr>td:last-child]:pr-6">
            {recordings.isPending &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="animate-pulse border-t border-line">
                  <td colSpan={6} className="py-4">
                    <div className="h-4 w-1/2 rounded bg-surface-2" />
                  </td>
                </tr>
              ))}
            {recordings.isError && (
              <tr>
                <td colSpan={6} className="py-6 text-center">
                  <p role="alert">{recordings.error.message}</p>
                  <Button className="mt-3" onClick={() => recordings.refetch()}>
                    Try again
                  </Button>
                </td>
              </tr>
            )}
            {items.map((recording) => (
              <Row key={recording.id} recording={recording} canChange={canChange} />
            ))}
            {recordings.isSuccess && items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-ink-2">
                  {search || filter !== 'all'
                    ? 'Nothing matches.'
                    : 'No recordings yet. Upload a call to begin.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {recordings.hasNextPage && (
          <div className="border-t border-line p-4 text-center">
            <Button onClick={() => recordings.fetchNextPage()} disabled={recordings.isFetchingNextPage}>
              {recordings.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
