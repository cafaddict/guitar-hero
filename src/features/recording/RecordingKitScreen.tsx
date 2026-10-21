import { useEffect, useRef, useState } from 'react';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import { audioEngine, captureReady, metronome, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import { CURRICULUM } from '../../content/curriculum';
import { voicingById } from '../../content/voicings';
import { createZip } from '../../data/zip';
import { newId } from '../../domain/ids';
import { unlockedChordClasses } from '../../domain/progression';
import type { RecordingMeta } from '../../domain/records';
import { stringNumber } from '../../domain/strings';
import { encodeWav } from '../../dsp/wav';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { TextInput } from '../../ui/Field';
import { Icon } from '../../ui/icons';
import { Screen } from '../../ui/Screen';
import { MicStatusPanel } from '../mic/MicStatusPanel';
import { fileExists, opfsSupported, readFile, saveFile } from './opfs';
import { IncompleteRecordingError, RawRecorder } from './rawRecorder';
import { buildLabels, clipFileName, type PlannedClip, recordingPlan, STRUM_GRID } from './recordingPlan';

function clipText(clip: PlannedClip): string {
  const k = ko.recording.kinds;
  const chord = clip.voicingId ? voicingById(clip.voicingId).symbol : '';
  switch (clip.kind) {
    case 'chord-strum':
      return k['chord-clean-strum'](chord);
    case 'chord-pluck':
      return k['chord-pluck'](chord);
    case 'chord-muted':
      return k['chord-muted'](chord, stringNumber(Number(clip.expected.mutedStringIdx)));
    case 'x-string':
      return k['x-string'](chord, stringNumber(Number(clip.expected.ringingIdx)));
    case 'one-minute': {
      const [a, b] = String(clip.expected.direction).split('>');
      return k['one-minute'](a ?? '', b ?? '');
    }
    case 'strum-grid':
      return k['strum-grid'](STRUM_GRID.bpm);
  }
}

function download(name: string, bytes: Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Settings > recording kit (SPEC §13.4): guided labelled clips for `bench:real`. */
export function RecordingKitScreen() {
  const status = useEngineStatus();
  const settings = useSettingsStore((s) => s.settings);
  const [plan, setPlan] = useState<PlannedClip[]>([]);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [active, setActive] = useState<{ clip: PlannedClip; startedAt: number } | null>(null);
  const [pendingCount, setPendingCount] = useState<{
    clip: PlannedClip;
    samples: Float32Array;
    extra: Record<string, unknown>;
  } | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<RawRecorder | null>(null);
  const extra = useRef<Record<string, unknown>>({});
  /** A record() call is between the tap and the recording state (double taps must not start two). */
  const starting = useRef(false);
  useMicReleasedOnExit();

  /** Any failure (microphone, storage quota, OPFS, lost capture ranges) ends the take with a message. */
  const fail = (error: unknown) => {
    recorder.current?.cancel();
    recorder.current = null;
    metronome.stop();
    setActive(null);
    setMessage(error instanceof IncompleteRecordingError ? ko.recording.gap : ko.recording.failed);
  };

  useEffect(() => {
    void repo
      .progression(Date.now())
      .then((p) => setPlan(recordingPlan(unlockedChordClasses(CURRICULUM, p.stage), p.gVoicing)));
    void repo.recordings().then(setRecordings);
    return () => {
      recorder.current?.cancel();
      metronome.stop();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const s = (Date.now() - active.startedAt) / 1000;
      setElapsed(s);
      if (s >= active.clip.seconds) void stop();
    }, 200);
    return () => clearInterval(id);
  });

  const store = async (clip: PlannedClip, samples: Float32Array, expected: Record<string, unknown>) => {
    const createdAt = Date.now();
    const fileName = clipFileName(clip.id, createdAt);
    await saveFile(fileName, encodeWav(samples, audioEngine.sampleRate));
    const labels = await audioEngine.deviceLabels();
    const calibration = await repo.latestCalibration(labels.input, labels.output);
    await repo.addRecording({
      id: newId(),
      createdAt,
      label: clip.id,
      kind: clip.kind,
      voicingId: clip.voicingId,
      expected,
      sampleRate: audioEngine.sampleRate,
      durationMs: Math.round((samples.length / audioEngine.sampleRate) * 1000),
      device: labels.input,
      calibrationId: calibration?.id ?? null,
      fileName,
    });
    setRecordings(await repo.recordings());
    setMessage(ko.recording.saved);
  };

  const record = async (clip: PlannedClip) => {
    if (starting.current) return;
    starting.current = true;
    try {
      await startRecording(clip);
    } catch (error) {
      fail(error);
    } finally {
      starting.current = false;
    }
  };

  const startRecording = async (clip: PlannedClip) => {
    const ok = await audioEngine.startMic({ deviceId: settings?.preferredInputDeviceId ?? null });
    if (!ok) return;
    await captureReady();
    audioEngine.setJob(null);
    const r = new RawRecorder(audioEngine);
    recorder.current = r;
    const start = r.start();
    extra.current = { ...clip.expected };
    if (clip.kind === 'strum-grid') {
      const labels = await audioEngine.deviceLabels();
      const calibration = await repo.latestCalibration(labels.input, labels.output);
      await metronome.start(
        { ...DEFAULT_METRONOME_CONFIG, bpm: STRUM_GRID.bpm, countInBars: 1, stopAfterBars: STRUM_GRID.bars },
        { rttMs: calibration?.rttMs ?? 0 },
      );
      extra.current = {
        ...clip.expected,
        gridStartS: (metronome.gridStartTime ?? start) - start,
        rttMs: calibration?.rttMs ?? null,
      };
    }
    setMessage(null);
    setActive({ clip, startedAt: Date.now() });
  };

  async function stop() {
    const current = active;
    const r = recorder.current;
    if (!current || !r) return;
    setActive(null);
    recorder.current = null;
    metronome.stop();
    try {
      const samples = await r.stop();
      if (current.clip.kind === 'one-minute') {
        setUserCount(0);
        setPendingCount({ clip: current.clip, samples, extra: extra.current });
        return;
      }
      await store(current.clip, samples, extra.current);
    } catch (error) {
      fail(error);
    }
  }

  const exportAll = async () => {
    try {
      // Rows restored from a backup carry no audio (OPFS files are not in the JSON backup): leave them out.
      const present = (
        await Promise.all(recordings.map(async (r) => ((await fileExists(r.fileName)) ? r : null)))
      ).filter((r): r is RecordingMeta => r !== null);
      if (present.length === 0) {
        setMessage(ko.recording.noFiles);
        return;
      }
      const labels = await audioEngine.deviceLabels().catch(() => ({ input: '', output: '' }));
      const calibration = await repo.latestCalibration();
      const sampleRate = present[0]?.sampleRate ?? audioEngine.sampleRate;
      const json = buildLabels(
        present,
        labels.input || present[0]?.device || 'device',
        sampleRate,
        calibration ?? null,
      );
      const files = await Promise.all(
        json.clips.map(async (c) => ({ name: c.file, data: await readFile(c.file) })),
      );
      files.push({ name: 'labels.json', data: new TextEncoder().encode(JSON.stringify(json, null, 1)) });
      download(`guitar-hero-recordings-${Date.now()}.zip`, createZip(files), 'application/zip');
      const missing = recordings.length - present.length;
      setMessage(missing > 0 ? ko.recording.exportedWithout(missing) : ko.recording.exported);
    } catch (error) {
      fail(error);
    }
  };

  if (!opfsSupported()) {
    return (
      <Screen title={ko.recording.title}>
        <p>{ko.recording.unsupported}</p>
      </Screen>
    );
  }
  const recordedIds = new Set(recordings.map((r) => r.label));
  const recordedCount = plan.filter((clip) => recordedIds.has(clip.id)).length;
  return (
    <Screen title={ko.recording.title}>
      <p className="text-lg text-muted">{ko.recording.intro}</p>
      <p className="mt-3 font-semibold tabular-nums" data-testid="recording-progress">
        {ko.recording.progress(recordedCount, plan.length)}
      </p>
      <MicStatusPanel status={status} onRetry={() => void audioEngine.startMic()} />
      <ol className="mt-4 space-y-2">
        {plan.map((clip) => (
          <li
            key={clip.id}
            className="card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
          >
            <span className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
              {recordedIds.has(clip.id) && (
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-ok text-bg"
                >
                  <Icon name="check" size={16} />
                </span>
              )}
              <span>
                {recordedIds.has(clip.id) && <span className="sr-only">✓ </span>}
                {clipText(clip)}
              </span>
            </span>
            {active?.clip.id === clip.id ? (
              <Button onClick={() => void stop()}>
                {ko.recording.stop} · {ko.recording.recording(elapsed)}
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={active !== null || pendingCount !== null}
                onClick={() => void record(clip)}
              >
                {ko.recording.record}
              </Button>
            )}
          </li>
        ))}
      </ol>
      {pendingCount && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3">
          <label htmlFor="recording-count">{ko.recording.count}</label>
          <TextInput
            id="recording-count"
            type="number"
            min={0}
            className="w-24"
            value={userCount}
            onChange={(e) => setUserCount(Number(e.target.value))}
          />
          <Button
            onClick={() => {
              const p = pendingCount;
              setPendingCount(null);
              void store(p.clip, p.samples, { ...p.extra, userCount }).catch(fail);
            }}
          >
            {ko.recording.save}
          </Button>
        </div>
      )}
      <div className="mt-4">
        {recordings.length === 0 ? (
          <p className="text-muted">{ko.recording.empty}</p>
        ) : (
          <Button onClick={() => void exportAll()}>{ko.recording.exportAll}</Button>
        )}
      </div>
      {message && (
        <p role="status" className="mt-2">
          {message}
        </p>
      )}
    </Screen>
  );
}
