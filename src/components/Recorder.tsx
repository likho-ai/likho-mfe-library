/**
 * Records from the microphone in the browser and hands the result over as a file, so a call
 * can be dictated or re-enacted without any other tool.
 */
import { Button } from '@likho-ai/ui';
import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function Recorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'unavailable'>(
    typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
      ? 'idle'
      : 'unavailable',
  );
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Leaving the page while recording: let the microphone go without handing over a file.
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      const media = recorder.current;
      if (media && media.state !== 'inactive') {
        media.onstop = null;
        media.stop();
        media.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const type = media.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        onRecorded(new File(chunks.current, `recording-${stamp}.${ext}`, { type }));
      };
      media.start(1000);
      recorder.current = media;
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setState('recording');
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'The browser did not allow the microphone. Allow it in the address bar and try again.'
          : 'No microphone could be opened.',
      );
    }
  };

  const stop = (discard = false) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const media = recorder.current;
    recorder.current = null;
    if (media && media.state !== 'inactive') {
      if (discard) media.onstop = () => media.stream.getTracks().forEach((track) => track.stop());
      media.stop();
    }
    setState((s) => (s === 'unavailable' ? s : 'idle'));
  };

  if (state === 'unavailable') return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === 'idle' ? (
        <Button onClick={start}>
          <Mic aria-hidden="true" />
          Record from the microphone
        </Button>
      ) : (
        <Button variant="primary" onClick={() => stop()} aria-live="polite">
          <Square aria-hidden="true" />
          Stop ({seconds}s) and upload
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--likho-status-failed-ink)]">
          {error}
        </p>
      )}
    </div>
  );
}
