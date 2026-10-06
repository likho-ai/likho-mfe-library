/**
 * The dialer's own calls of chosen days, read from its reporting database through the connector:
 * pick the days, then a campaign and an agent from the dialer's real lists (with their counts),
 * tick the calls worth a transcript and fetch them together. A call Likho already has links to it.
 */
import { Button } from '@likho-ai/ui';
import {
  useDialerAgents,
  useDialerCalls,
  useDialerCampaigns,
  useRequestImports,
  type DialerCall,
} from '@likho-ai/web-sdk';
import { DownloadCloud } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { clock } from '../lib/format';

const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** From the start of the first day to the start of the day after the last, in the browser's zone. */
const windowOf = (from: string, to: string) => {
  const since = new Date(`${from}T00:00:00`);
  const until = new Date(`${to}T00:00:00`);
  until.setDate(until.getDate() + 1);
  return { since: since.toISOString(), until: until.toISOString() };
};

const control =
  'min-h-11 rounded-input border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:outline-accent';
const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3';
const td = 'px-3 py-2 align-top';

export function DialerCalls() {
  const [from, setFrom] = useState(() => day(-1));
  const [to, setTo] = useState(() => day(0));
  const [campaign, setCampaign] = useState('');
  const [agent, setAgent] = useState('');
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [minTalk, setMinTalk] = useState(20);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const valid = Boolean(from && to && from <= to);
  const window = useMemo(() => (valid ? windowOf(from, to) : { since: '', until: '' }), [from, to, valid]);

  const campaigns = useDialerCampaigns(window);
  const agents = useDialerAgents(window, campaign);
  const calls = useDialerCalls(
    {
      ...window,
      campaign: campaign || null,
      agent: agent || null,
      connectedOnly,
      minTalkSeconds: minTalk || 0,
    },
    50,
  );
  const fetchMany = useRequestImports();
  const rows: DialerCall[] = (calls.data?.pages ?? []).flatMap((p) => p.items);
  const fetchable = rows.filter((c) => !c.recordingId);
  const toggle = (crt: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(crt)) next.delete(crt);
      else next.add(crt);
      return next;
    });
  const allPicked = fetchable.length > 0 && fetchable.every((c) => picked.has(c.crtObjectId));
  const fetchPicked = () =>
    fetchMany.mutate([...picked].slice(0, 200), { onSuccess: () => setPicked(new Set()) });

  return (
    <section
      aria-labelledby="dialer-calls-title"
      className="rounded-card border border-line bg-surface p-6 shadow-card"
    >
      <h2 id="dialer-calls-title" className="flex items-center gap-2 text-xl font-bold">
        <DownloadCloud aria-hidden="true" className="size-5 text-accent-strong" />
        The dialer’s calls
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Read from the dialer itself. Choose the days, a campaign and an agent, tick the calls worth a
        transcript, and fetch them; they arrive in the list below and are transcribed.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3" role="group" aria-label="Which calls">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-2">From</span>
          <input
            type="date"
            className={control}
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-2">To</span>
          <input
            type="date"
            className={control}
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-2">Campaign</span>
          <select
            aria-label="Campaign"
            className={control}
            value={campaign}
            onChange={(e) => {
              setCampaign(e.target.value);
              setAgent('');
            }}
          >
            <option value="">Any campaign</option>
            {(campaigns.data ?? []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.connected} of {c.calls} connected)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-2">Agent</span>
          <select
            aria-label="Agent"
            className={control}
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="">Any agent</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.name} value={a.name}>
                {a.name} ({a.calls})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-2">Talked at least (s)</span>
          <input
            type="number"
            min={0}
            className={`${control} w-28`}
            value={minTalk}
            onChange={(e) => setMinTalk(Math.max(0, e.target.valueAsNumber || 0))}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--likho-accent)]"
            checked={connectedOnly}
            onChange={(e) => setConnectedOnly(e.target.checked)}
          />
          Connected only
        </label>
      </div>

      {(campaigns.isError || calls.isError) && (
        <p role="alert" className="mt-3 text-sm text-[var(--likho-status-failed-ink)]">
          {(campaigns.error ?? calls.error)?.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-2" aria-live="polite">
          {calls.isPending ? 'Asking the dialer…' : `${rows.length}${calls.hasNextPage ? '+' : ''} calls`}
          {picked.size > 0 && `, ${picked.size} ticked`}
        </span>
        <Button variant="primary" disabled={picked.size === 0 || fetchMany.isPending} onClick={fetchPicked}>
          {fetchMany.isPending ? 'Asking…' : `Fetch ${picked.size || ''} ticked`.replace('  ', ' ')}
        </Button>
      </div>
      {fetchMany.isSuccess && picked.size === 0 && (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {fetchMany.data.length} call{fetchMany.data.length === 1 ? '' : 's'} asked for; they appear below as
          they arrive.
        </p>
      )}
      {fetchMany.error && (
        <p role="alert" className="mt-2 text-sm text-[var(--likho-status-failed-ink)]">
          {fetchMany.error.message}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm" aria-label="The dialer’s calls">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>
                <input
                  type="checkbox"
                  aria-label="Tick every call not in Likho"
                  className="size-4 accent-[var(--likho-accent)]"
                  checked={allPicked}
                  disabled={fetchable.length === 0}
                  onChange={() =>
                    setPicked(allPicked ? new Set() : new Set(fetchable.map((c) => c.crtObjectId)))
                  }
                />
              </th>
              <th className={th}>Time</th>
              <th className={th}>Campaign</th>
              <th className={th}>Agent</th>
              <th className={th}>Disposition</th>
              <th className={`${th} text-right`}>Talk</th>
              <th className={th}>Hung up</th>
              <th className={th}>In Likho</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={`${c.crtObjectId}-${c.callId}`} className="border-b border-line last:border-0">
                <td className={td}>
                  {!c.recordingId && (
                    <input
                      type="checkbox"
                      aria-label={`Tick ${c.crtObjectId}`}
                      className="size-4 accent-[var(--likho-accent)]"
                      checked={picked.has(c.crtObjectId)}
                      onChange={() => toggle(c.crtObjectId)}
                    />
                  )}
                </td>
                <td className={`${td} whitespace-nowrap font-mono text-xs`}>{c.callTime}</td>
                <td className={td}>
                  {c.campaign}
                  {c.transferredCampaign && (
                    <span className="block text-xs text-ink-3">→ {c.transferredCampaign}</span>
                  )}
                </td>
                <td className={td}>{c.agent || '—'}</td>
                <td className={td}>{c.disposition || (c.connected ? '—' : 'not connected')}</td>
                <td className={`${td} text-right font-mono text-xs`}>{clock(c.talkSeconds)}</td>
                <td className={td}>{c.hangupBy || '—'}</td>
                <td className={td}>
                  {c.recordingId ? (
                    <Link className="text-link underline" to={`/recordings/${c.recordingId}`}>
                      {c.recordingStatus === 'done' ? 'Open transcript' : 'Open'}
                    </Link>
                  ) : (
                    <span className="text-ink-3">not yet</span>
                  )}
                </td>
              </tr>
            ))}
            {calls.isSuccess && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-ink-2">
                  The dialer has no calls like these on those days.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {calls.hasNextPage && (
        <div className="mt-3 text-center">
          <Button
            variant="secondary"
            onClick={() => void calls.fetchNextPage()}
            disabled={calls.isFetchingNextPage}
          >
            {calls.isFetchingNextPage ? 'Loading…' : 'More calls'}
          </Button>
        </div>
      )}
    </section>
  );
}
