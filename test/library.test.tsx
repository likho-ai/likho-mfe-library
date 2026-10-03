import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import App from '../src/App';
import { fakeApi, renderAt } from './helpers';

const recording = (id: string, name: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  originalName: name,
  mediaId: 'med_' + id,
  sizeBytes: 1000,
  sha256: '',
  durationSeconds: 61.5,
  channels: 1,
  sampleRate: 8000,
  source: 'upload',
  externalId: '',
  status,
  failureReason: '',
  latestTranscriptId: '',
  detectedLanguage: 'hi',
  languageProbability: 0.91,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  jobs: [],
  ...extra,
});

const counts = { uploading: 0, uploaded: 0, ready: 1, failed: 1, queued: 0, transcribing: 1, done: 2 };

function page(client: ReturnType<typeof fakeApi>['client'], path = '/recordings') {
  // EventSource is not in jsdom; the live updates stay quiet in tests.
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener() {}
      close() {}
    },
  );
  return renderAt(
    path,
    <Routes>
      <Route path="/recordings" element={<App />} />
    </Routes>,
    client,
  );
}

describe('the recordings library', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the calls with their state, language and length', async () => {
    const { client } = fakeApi({
      Recordings: () => ({
        recordings: {
          items: [
            recording('rec_1', 'morning call.mp3', 'done'),
            recording('rec_2', 'afternoon call.mp3', 'transcribing', {
              jobs: [
                {
                  id: 'job_2',
                  status: 'running',
                  progressSeconds: 30,
                  totalSeconds: 60,
                  recordingId: 'rec_2',
                },
              ],
            }),
            recording('rec_3', 'notes.txt', 'failed', {
              failureReason: 'The file is not audio that can be read',
            }),
          ],
          hasMore: false,
          endCursor: 'rec_3',
        },
      }),
      RecordingCounts: () => ({ recordingCounts: counts }),
    });
    page(client);

    expect(await screen.findByText('morning call.mp3')).toBeInTheDocument();
    expect(screen.getByText('5 calls')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Done')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Hindi 91%')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('01:02')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/recordings/rec_1');
    expect(within(rows[1]!).getByText('Transcribing')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('link', { name: 'Watch live' })).toBeInTheDocument();
    expect(within(rows[2]!).getByText('The file is not audio that can be read')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Done\s*2/ })).toBeInTheDocument();
  });

  it('filters by status and searches by name', async () => {
    const { client, calls } = fakeApi({
      Recordings: (v) => {
        const filter = (v.filter ?? {}) as { status?: string[]; search?: string };
        const items = filter.search
          ? [recording('rec_9', 'the one.mp3', 'done')]
          : filter.status?.includes('failed')
            ? [recording('rec_3', 'notes.txt', 'failed')]
            : [recording('rec_1', 'morning call.mp3', 'done')];
        return { recordings: { items, hasMore: false, endCursor: null } };
      },
      RecordingCounts: () => ({ recordingCounts: counts }),
    });
    page(client);
    expect(await screen.findByText('morning call.mp3')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Failed/ }));
    expect(await screen.findByText('notes.txt')).toBeInTheDocument();
    expect(calls.at(-1)!.variables).toMatchObject({ filter: { status: ['failed'] } });

    await user.type(screen.getByRole('searchbox'), 'the one');
    expect(await screen.findByText('the one.mp3')).toBeInTheDocument();
    await waitFor(() =>
      expect((calls.at(-1)!.variables.filter as { search: string }).search).toBe('the one'),
    );
  });

  it('opens the upload panel from the address and starts a job by hand', async () => {
    const created: string[] = [];
    const { client } = fakeApi({
      Recordings: () => ({
        recordings: { items: [recording('rec_1', 'waiting.mp3', 'ready')], hasMore: false, endCursor: null },
      }),
      RecordingCounts: () => ({ recordingCounts: counts }),
      CreateJob: (v) => {
        const input = v.input as { recordingId: string };
        created.push(input.recordingId);
        return {
          createJob: {
            id: 'job_1',
            recordingId: input.recordingId,
            status: 'queued',
            modelRegistryId: '',
            languagePolicy: 'auto',
            force: false,
            progressSeconds: 0,
            totalSeconds: 61.5,
            errorCode: '',
            errorMessage: '',
            transcriptId: '',
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
          },
        };
      },
    });
    page(client, '/recordings?upload=1');
    expect(await screen.findByRole('heading', { name: 'Upload calls' })).toBeInTheDocument();
    expect(screen.getByLabelText('Choose files')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Transcribe' }));
    await waitFor(() => expect(created).toEqual(['rec_1']));
  });

  it('fetches a call from the dialer by its id and shows how it went', async () => {
    const asked: string[] = [];
    const row = (id: string, externalId: string, status: string, extra: Record<string, unknown> = {}) => ({
      id,
      source: 'ameyo',
      externalId,
      transcribe: true,
      status,
      recordingId: '',
      reason: '',
      code: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra,
    });
    const { client } = fakeApi({
      Recordings: () => ({ recordings: { items: [], hasMore: false, endCursor: null } }),
      RecordingCounts: () => ({ recordingCounts: counts }),
      Imports: () => ({
        imports: {
          items: [
            row('imp_2', 'd000-0a1b2c3d-vce-0002', 'failed', {
              reason: 'The dialer has no recording for this call.',
              code: 'no_recording',
            }),
            row('imp_1', 'd000-0a1b2c3d-vce-0001', 'completed', { recordingId: 'rec_9' }),
          ],
          hasMore: false,
        },
      }),
      RequestImport: (v) => {
        const input = v.input as { externalId: string };
        asked.push(input.externalId);
        return { requestImport: row('imp_3', input.externalId, 'requested') };
      },
    });
    page(client, '/recordings?upload=1');
    const section = await screen.findByRole('region', { name: 'From the dialer' });
    const list = await within(section).findByRole('list', { name: 'Calls asked for' });
    expect(within(list).getByRole('link', { name: 'Fetched — open' })).toHaveAttribute(
      'href',
      '/recordings/rec_9',
    );
    expect(within(list).getByRole('alert')).toHaveTextContent('The dialer has no recording for this call.');

    const user = userEvent.setup();
    const button = within(section).getByRole('button', { name: 'Fetch call' });
    expect(button).toBeDisabled();
    await user.type(within(section).getByLabelText('Call id'), 'd000-0a1b2c3d-vce-0003');
    await user.click(button);
    await waitFor(() => expect(asked).toEqual(['d000-0a1b2c3d-vce-0003']));
    await waitFor(() => expect(within(section).getByLabelText('Call id')).toHaveValue(''));
  });

  it('says so when there is nothing yet', async () => {
    const { client } = fakeApi({
      Recordings: () => ({ recordings: { items: [], hasMore: false, endCursor: null } }),
      RecordingCounts: () => ({
        recordingCounts: { ...counts, ready: 0, failed: 0, transcribing: 0, done: 0 },
      }),
    });
    page(client);
    expect(await screen.findByText('No recordings yet. Upload a call to begin.')).toBeInTheDocument();
  });
});
