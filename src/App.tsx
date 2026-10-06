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
  useRecordingFacets,
  useRecordings,
  useUploader,
  useWorkspaceLive,
  type FacetValue,
  type Recording,
  type RecordingFilter,
  type RecordingStatus,
} from '@likho-ai/web-sdk';
import { Search, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DialerCalls } from './components/DialerCalls';
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

const select =
  'min-h-11 rounded-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-accent';

/** The campaign, agent and dates in the address, so a narrowed library can be shared. */
function readNarrowing(params: URLSearchParams) {
  return {
    campaign: params.get('campaign') ?? '',
    agent: params.get('agent') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  };
}

/** The filter the API takes from the address: a day's first and last moment on the call time. */
export function factsFilter(n: ReturnType<typeof readNarrowing>): RecordingFilter {
  const filter: RecordingFilter = {};
  if (n.campaign) filter.campaign = n.campaign;
  if (n.agent) filter.agent = n.agent;
  if (n.from) filter.since = new Date(`${n.from}T00:00:00`).toISOString();
  if (n.to) filter.until = new Date(`${n.to}T23:59:59.999`).toISOString();
  return filter;
}

const attribute = (recording: Recording, key: string) =>
  recording.attributes.find((a) => a.key === key)?.value ?? '';

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
        {attribute(recording, 'campaign') || '—'}
        {attribute(recording, 'disposition') && (
          <span className="block text-xs text-ink-3">{attribute(recording, 'disposition')}</span>
        )}
      </td>
      <td className="py-3 pr-4 text-ink-2">{attribute(recording, 'agent') || '—'}</td>
      <td className="py-3 pr-4 text-ink-2">
        {recording.detectedLanguage
          ? `${languageName(recording.detectedLanguage)} ${Math.round(recording.languageProbability * 100)}%`
          : '—'}
      </td>
      <td className="py-3 pr-4 font-mono text-sm tabular-nums text-ink-2">
        {recording.durationSeconds ? clock(recording.durationSeconds) : '—'}
      </td>
      <td className="py-3 pr-4 text-ink-2" title={new Date(recording.callTime).toLocaleString()}>
        {when(recording.callTime)}
      </td>
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

/** A select over the values a fact takes, with counts. */
function FactSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: FacetValue[] | undefined;
  onChange: (value: string) => void;
}) {
  const known = values ?? [];
  const options = value && !known.some((v) => v.value === value) ? [{ value, count: 0 }, ...known] : known;
  if (!value && known.length === 0) return null; // nothing to narrow by yet
  return (
    <select className={select} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Any {label.toLowerCase()}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.value}
          {option.count ? ` (${option.count})` : ''}
        </option>
      ))}
    </select>
  );
}

export default function App() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const statuses = FILTERS.find((f) => f.key === filter)?.statuses;
  const narrowing = readNarrowing(params);
  const facts = factsFilter(narrowing);
  const narrowed = Object.values(narrowing).some(Boolean);
  const recordings = useRecordings({ ...facts, status: statuses ?? null, search: deferredSearch || null });
  const counts = useRecordingCounts();
  const campaigns = useRecordingFacets('campaign');
  const agents = useRecordingFacets(
    'agent',
    narrowing.campaign ? { campaign: narrowing.campaign } : undefined,
  );
  const uploader = useUploader();
  const live = useWorkspaceLive();
  const me = useMe();
  // A viewer reads, plays and searches; the ways to change things are not shown to them.
  const canChange = me.data?.role !== 'viewer';
  const showUpload = canChange && params.get('upload') === '1';
  const showDialer = canChange && params.get('dialer') === '1';

  const narrow = (next: Partial<typeof narrowing> & { upload?: string; dialer?: string }) => {
    const fresh = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ ...narrowing, ...next })) {
      if (value) fresh.set(key, value);
      else fresh.delete(key);
    }
    setParams(fresh);
  };

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
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showDialer ? 'secondary' : 'ghost'}
              onClick={() => narrow({ dialer: showDialer ? '' : '1' })}
              aria-expanded={showDialer}
            >
              {showDialer ? 'Hide the dialer' : 'Browse the dialer'}
            </Button>
            <Button
              variant={showUpload ? 'secondary' : 'primary'}
              onClick={() => narrow({ upload: showUpload ? '' : '1' })}
              aria-expanded={showUpload}
            >
              {showUpload ? 'Hide upload' : 'Upload call'}
            </Button>
          </div>
        )}
      </div>

      {showUpload && (
        <>
          <UploadPanel items={uploader.items} onFiles={uploader.add} onClear={uploader.clear} />
          <DialerImport />
        </>
      )}
      {showDialer && canChange && <DialerCalls />}

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

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Narrow by the facts of the call"
      >
        <FactSelect
          label="Campaign"
          value={narrowing.campaign}
          values={campaigns.data}
          onChange={(campaign) => narrow({ campaign, agent: '' })}
        />
        <FactSelect
          label="Agent"
          value={narrowing.agent}
          values={agents.data}
          onChange={(agent) => narrow({ agent })}
        />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          From
          <input
            type="date"
            aria-label="Calls from"
            className={select}
            value={narrowing.from}
            max={narrowing.to || undefined}
            onChange={(e) => narrow({ from: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          To
          <input
            type="date"
            aria-label="Calls up to"
            className={select}
            value={narrowing.to}
            min={narrowing.from || undefined}
            onChange={(e) => narrow({ to: e.target.value })}
          />
        </label>
        {narrowed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => narrow({ campaign: '', agent: '', from: '', to: '' })}
          >
            <X aria-hidden="true" className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="text-ink-3">
            <tr>
              <th className="px-6 py-3 font-medium">Recording</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Campaign</th>
              <th className="py-3 pr-4 font-medium">Agent</th>
              <th className="py-3 pr-4 font-medium">Language</th>
              <th className="py-3 pr-4 font-medium">Length</th>
              <th className="py-3 pr-4 font-medium">Call time</th>
              <th className="py-3 pr-6 text-right font-medium">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr>td:first-child]:pl-6 [&>tr>td:last-child]:pr-6">
            {recordings.isPending &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="animate-pulse border-t border-line">
                  <td colSpan={8} className="py-4">
                    <div className="h-4 w-1/2 rounded bg-surface-2" />
                  </td>
                </tr>
              ))}
            {recordings.isError && (
              <tr>
                <td colSpan={8} className="py-6 text-center">
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
                <td colSpan={8} className="py-10 text-center text-ink-2">
                  {search || filter !== 'all' || narrowed
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
