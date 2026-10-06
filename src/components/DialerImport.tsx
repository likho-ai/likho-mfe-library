import { Button } from '@likho-ai/ui';
import { useImports, useRequestImport } from '@likho-ai/web-sdk';
import { PhoneIncoming } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { when } from '../lib/format';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

/**
 * Fetch a call from the dialer by its id. The connector gets the audio; the recording appears
 * in the list when it has, and the row here says how it went.
 */
export function DialerImport() {
  const [id, setId] = useState('');
  const request = useRequestImport();
  const imports = useImports(undefined, 8);
  const trimmed = id.trim();
  const valid = ID_PATTERN.test(trimmed);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    request.mutate({ externalId: trimmed }, { onSuccess: () => setId('') });
  };

  return (
    <section
      aria-labelledby="dialer-title"
      className="rounded-card border border-line bg-surface p-6 shadow-card"
    >
      <h2 id="dialer-title" className="flex items-center gap-2 text-xl font-bold">
        <PhoneIncoming aria-hidden="true" className="size-5 text-accent-strong" />
        From the dialer
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Paste a call id from a report (<code>…-vcall-…</code>) or its interaction id, the CRT (
        <code>…-vce-…</code>); the recording is fetched and transcribed.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row" aria-label="Fetch a call">
        <label className="flex-1">
          <span className="sr-only">Call id</span>
          <input
            className="min-h-11 w-full rounded-input border border-line-strong bg-surface px-3 font-mono text-sm text-ink focus-visible:outline-accent"
            placeholder="d000-0a1b2c3d-vce-0001"
            value={id}
            onChange={(event) => setId(event.target.value)}
            spellCheck={false}
          />
        </label>
        <Button type="submit" variant="primary" disabled={!valid || request.isPending}>
          {request.isPending ? 'Asking…' : 'Fetch call'}
        </Button>
      </form>
      {request.error && (
        <p role="alert" className="mt-2 text-sm text-[var(--likho-status-failed-ink)]">
          {request.error.message}
        </p>
      )}

      {imports.data && imports.data.items.length > 0 && (
        <ul className="mt-4 divide-y divide-line" aria-label="Calls asked for">
          {imports.data.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">{item.externalId}</span>
              <span className="text-ink-3">{when(item.createdAt)}</span>
              <span className="w-full sm:w-64">
                {item.status === 'requested' && <span className="text-ink-3">Fetching from the dialer…</span>}
                {item.status === 'completed' && item.recordingId && (
                  <Link className="text-link underline" to={`/recordings/${item.recordingId}`}>
                    Fetched — open
                  </Link>
                )}
                {item.status === 'failed' && (
                  <span role="alert" className="text-[var(--likho-status-failed-ink)]">
                    {item.reason || 'The call could not be fetched.'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
