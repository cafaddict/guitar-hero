import { useEffect, useRef, useState } from 'react';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import { audioEngine } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { STRING_INDICES, stringNumber } from '../../domain/strings';
import { midiName, STANDARD_TUNING } from '../../domain/theory';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { CentsNeedle } from '../../ui/CentsNeedle';
import { Icon } from '../../ui/icons';
import { LevelMeter } from '../../ui/LevelMeter';
import { Screen } from '../../ui/Screen';
import { TuningDirection } from '../../ui/TuningDirection';
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
  const headStyle = useSettingsStore((s) => s.settings?.headStyle ?? '3+3');
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
    <Screen title={ko.tuner.title} width="wide">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
        <div className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1">
          <div className="flex flex-wrap gap-3" data-primary-action>
            {running ? (
              <Button large variant="secondary" onClick={() => audioEngine.stopMic()}>
                {ko.tuner.stop}
              </Button>
            ) : (
              <Button large onClick={start}>
                <Icon name="tuner" />
                {ko.tuner.start}
              </Button>
            )}
          </div>
          <MicStatusPanel status={status} onRetry={start} />
          <fieldset>
            <legend className="mb-2 font-semibold">{ko.tuner.stringMode}</legend>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                aria-pressed={target.kind === 'auto'}
                selected={target.kind === 'auto' ? 'accent' : null}
                onClick={() => setTarget({ kind: 'auto' })}
              >
                {ko.tuner.auto}
              </Button>
              {STRING_INDICES.map((idx) => {
                const selected = target.kind === 'string' && target.idx === idx;
                return (
                  <Button
                    key={idx}
                    variant="secondary"
                    aria-pressed={selected}
                    selected={selected ? 'accent' : null}
                    onClick={() => setTarget({ kind: 'string', idx })}
                  >
                    {ko.common.stringLabel(stringNumber(idx), midiName(STANDARD_TUNING.openMidi[idx]!))}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <LevelMeter read={readLevel} label={ko.diagnostics.level} />
          <p className="text-muted">{ko.tuner.judgingOff}</p>
        </div>
        <section
          className="card flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-8 lg:col-start-1 lg:row-start-1"
          aria-live="polite"
        >
          <p className="text-center text-7xl font-bold sm:text-8xl" data-testid="tuner-note">
            {display?.note ?? '—'}
          </p>
          <p className="min-h-8 text-center text-2xl tabular-nums text-muted" data-testid="tuner-cents">
            {display ? ko.common.cents(display.cents) : running ? ko.tuner.listening : ko.tuner.idle}
          </p>
          <CentsNeedle cents={display?.cents ?? null} passCents={IN_TUNE_CENTS} label={ko.tuner.title} />
          <div className="flex justify-center">
            <TuningDirection
              cents={display?.cents ?? null}
              stringIdx={target.kind === 'string' ? target.idx : null}
              head={headStyle}
            />
          </div>
          <p
            className={`min-h-9 text-center text-2xl font-bold ${inTune ? 'text-ok' : 'text-retry'}`}
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
      </div>
    </Screen>
  );
}
