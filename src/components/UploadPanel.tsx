import { Button, Meter } from '@likho-ai/ui';
import type { UploadItem } from '@likho-ai/web-sdk';
import { Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { fileSize } from '../lib/format';
import { Recorder } from './Recorder';

const ACCEPT = '.mp3,.wav,.m4a,.mp4,.ogg,.webm,.flac,.aac,.amr,audio/*,video/mp4';

export function UploadPanel({
  items,
  onFiles,
  onClear,
}: {
  items: UploadItem[];
  onFiles: (files: File[]) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const files = Array.from(event.dataTransfer.files).filter((f) => f.size > 0);
    if (files.length) onFiles(files);
  };

  return (
    <section
      aria-labelledby="upload-title"
      className="rounded-card border border-line bg-surface p-6 shadow-card"
    >
      <h2 id="upload-title" className="text-xl font-bold">
        Upload calls
      </h2>
      <div
        role="group"
        aria-label="Drop files here"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={`mt-4 flex flex-col items-center gap-3 rounded-dropzone border-2 border-dashed px-6 py-10 text-center transition-colors ${
          over ? 'border-accent bg-accent-soft' : 'border-line-strong'
        }`}
      >
        <Upload aria-hidden="true" className="size-8 text-accent-strong" />
        <p className="text-ink-2">Drop MP3, WAV, M4A or MP4 files here, several at once.</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Choose files"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => input.current?.click()}>
            Browse files
          </Button>
          <Recorder onRecorded={(file) => onFiles([file])} />
        </div>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-line" aria-label="Upload queue">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">{item.name}</span>
              <span className="text-ink-3">{fileSize(item.sizeBytes)}</span>
              <span className="w-full sm:w-64">
                {item.state === 'uploading' && <Meter label="Uploading" value={item.progress} />}
                {item.state === 'waiting' && <span className="text-ink-3">Waiting…</span>}
                {item.state === 'done' && item.recordingId && (
                  <Link className="text-link underline" to={`/recordings/${item.recordingId}`}>
                    Uploaded — open
                  </Link>
                )}
                {item.state === 'duplicate' && item.recordingId && (
                  <span>
                    Already here:{' '}
                    <Link className="text-link underline" to={`/recordings/${item.recordingId}`}>
                      open the earlier upload
                    </Link>
                  </span>
                )}
                {item.state === 'failed' && (
                  <span role="alert" className="text-[var(--likho-status-failed-ink)]">
                    {item.error}
                  </span>
                )}
              </span>
            </li>
          ))}
          <li className="pt-3">
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear finished
            </Button>
          </li>
        </ul>
      )}
    </section>
  );
}
