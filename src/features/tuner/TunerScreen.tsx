import { useEffect, useRef, useState } from 'react';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import { audioEngine } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { STRING_INDICES, stringNumber } from '../../domain/strings';
import { midiName, STANDARD_TUNING } from '../../domain/theory';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { CentsNeedle } from '../../ui/CentsNeedle';
import { LevelMeter } from '../../ui/LevelMeter';
import { Screen } from '../../ui/Screen';
import { MicStatusPanel } from '../mic/MicStatusPanel';
import {
  displayFor,
  expectedF0For,
  IN_TUNE_CENTS,
  InTuneTracker,
  type TunerDisplay,
  type TunerTarget,
} from './tunerModel';

const readLevel = () => audioEngine.latestLevel;

/** Tuner screen (SPEC §9.2). While it is open the microphone only tunes (no judging jobs). */
export function TunerScreen() {
  const status = useEngineStatus();
  const settings = useSettingsStore((s) => s.settings);
  const [target, setTarget] = useState<TunerTarget>({ kind: 'auto' });
  const [display, setDisplay] = useState<TunerDisplay | null>(null);
  const [inTune, setInTune] = useState(false);
  const tracker = useRef(new InTuneTracker());
  const running = status.kind === 'running';
  useMicReleasedOnExit();

  useEffect(() => {
    if (!running) return;
    tracker.current.reset();
    setDisplay(null);
    setInTune(false);
    audioEngine.setJob(null);
    audioEngine.setTuner(true, expectedF0For(target));
    const off = audioEngine.tuner.on((update) => {
      const next = update.reading ? displayFor(target, update.reading.f0) : null;
      setDisplay((prev) => next ?? prev);
      setInTune(tracker.current.push(next ? next.cents : null));
    });
    return () => {
      off();
      audioEngine.setTuner(false, null);
    };
  }, [running, target]);

  // Called straight from the tap handler: no await before startMic so iOS keeps the user-gesture chain.
  const start = () => void audioEngine.startMic({ deviceId: settings?.preferredInputDeviceId ?? null });

  return (
    <Screen title={ko.tuner.title}>
      <div className="flex flex-wrap gap-2">
        {running ? (
          <Button variant="secondary" onClick={() => audioEngine.stopMic()}>
            {ko.tuner.stop}
          </Button>
        ) : (
          <Button large onClick={start}>
            {ko.tuner.start}
          </Button>
        )}
      </div>
      <MicStatusPanel status={status} onRetry={start} />
      <fieldset className="mt-4">
        <legend className="text-sm text-muted">{ko.tuner.stringMode}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            variant={target.kind === 'auto' ? 'primary' : 'secondary'}
            aria-pressed={target.kind === 'auto'}
            onClick={() => setTarget({ kind: 'auto' })}
          >
            {ko.tuner.auto}
          </Button>
          {STRING_INDICES.map((idx) => {
            const selected = target.kind === 'string' && target.idx === idx;
            return (
              <Button
                key={idx}
                variant={selected ? 'primary' : 'secondary'}
                aria-pressed={selected}
                onClick={() => setTarget({ kind: 'string', idx })}
              >
                {ko.common.stringLabel(stringNumber(idx), midiName(STANDARD_TUNING.openMidi[idx]!))}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <section className="mt-6 rounded-lg bg-surface p-4" aria-live="polite">
        <p className="text-center text-5xl font-bold" data-testid="tuner-note">
          {display?.note ?? '—'}
        </p>
        <p className="mt-1 text-center text-muted" data-testid="tuner-cents">
          {display ? ko.common.cents(display.cents) : running ? ko.tuner.listening : ''}
        </p>
        <div className="mt-3">
          <CentsNeedle cents={display?.cents ?? null} passCents={IN_TUNE_CENTS} label={ko.tuner.title} />
        </div>
        <p
          className={`mt-3 text-center text-xl font-bold ${inTune ? 'text-ok' : 'text-retry'}`}
          data-testid="tuner-status"
        >
          {display === null
            ? ''
            : inTune
              ? ko.tuner.inTune
              : display.cents < 0
                ? ko.tuner.tuneUp
                : ko.tuner.tuneDown}
        </p>
      </section>
      <div className="mt-4">
        <LevelMeter read={readLevel} label={ko.diagnostics.level} />
      </div>
      <p className="mt-4 text-sm text-muted">{ko.tuner.judgingOff}</p>
    </Screen>
  );
}
