import { useEffect, useRef, useState } from 'react';
import { audioEngine, metronome } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import {
  beatsPerBar,
  clampBpm,
  DEFAULT_METRONOME_CONFIG,
  latestPassedClick,
  type Meter,
  type MetronomeConfig,
  nextLadderBpm,
  type ScheduledClick,
  type Subdivision,
  TapTempo,
} from '../../audio/metronome';
import { wakeLock } from '../../audio/wakeLock';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Choice, Field, Select, TextInput } from '../../ui/Field';
import { Icon } from '../../ui/icons';
import { Screen } from '../../ui/Screen';

const MUTED_OPTIONS: (MetronomeConfig['mutedBars'] | null)[] = [
  null,
  { play: 1, mute: 1 },
  { play: 2, mute: 1 },
  { play: 3, mute: 1 },
  { play: 2, mute: 2 },
];
/** Beat positions for the pulse dots (largest meter is 6/8). */
const BEAT_NUMBERS = [0, 1, 2, 3, 4, 5] as const;
type Limit = { kind: 'none' } | { kind: 'bars'; n: number } | { kind: 'minutes'; n: number };
const LIMIT_OPTIONS: Limit[] = [
  { kind: 'none' },
  { kind: 'bars', n: 4 },
  { kind: 'bars', n: 8 },
  { kind: 'bars', n: 16 },
  { kind: 'minutes', n: 1 },
  { kind: 'minutes', n: 5 },
];

function limitLabel(limit: Limit): string {
  if (limit.kind === 'none') return ko.metronome.limitOff;
  return limit.kind === 'bars' ? ko.metronome.limitBars(limit.n) : ko.metronome.limitMinutes(limit.n);
}

/** Visual pulse: polled from requestAnimationFrame against the audio clock (SPEC §8.4). */
function usePulse(running: boolean): ScheduledClick | null {
  const [click, setClick] = useState<ScheduledClick | null>(null);
  useEffect(() => {
    if (!running) {
      setClick(null);
      return;
    }
    let frame = 0;
    let lastIndex = -1;
    const loop = () => {
      const ctx = audioEngine.context;
      if (ctx) {
        const current = latestPassedClick(metronome.recentClicks(), ctx.currentTime);
        if (current && current.index !== lastIndex) {
          lastIndex = current.index;
          setClick(current);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return click;
}

function OptionSelect<T>({
  label,
  options,
  value,
  render,
  onChange,
  testId,
}: {
  label: string;
  options: readonly T[];
  value: T;
  render: (v: T) => string;
  onChange: (v: T) => void;
  testId: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => JSON.stringify(o) === JSON.stringify(value)),
  );
  return (
    <Field label={label}>
      <Select data-testid={testId} value={index} onChange={(e) => onChange(options[Number(e.target.value)]!)}>
        {options.map((o, i) => (
          <option key={render(o)} value={i}>
            {render(o)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function MetronomeScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const [config, setConfig] = useState<MetronomeConfig>(DEFAULT_METRONOME_CONFIG);
  const [limit, setLimit] = useState<Limit>({ kind: 'none' });
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [ladder, setLadder] = useState({ startBpm: 60, targetBpm: 90, stepBpm: 5 });
  const tap = useRef(new TapTempo());
  const pulse = usePulse(running);

  useEffect(() => {
    if (settings) setConfig((c) => ({ ...c, visualOnly: settings.visualOnlyMetronome }));
  }, [settings]);

  useEffect(() => {
    const offRun = metronome.running.on(setRunning);
    const offEnd = metronome.end.on(() => setEnded(true));
    return () => {
      offRun();
      offEnd();
      metronome.stop();
      void wakeLock().disable();
    };
  }, []);

  useEffect(() => {
    if (running) void wakeLock().enable();
    else void wakeLock().disable();
  }, [running]);

  const update = (patch: Partial<MetronomeConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    if (!running) return;
    if (patch.bpm !== undefined) metronome.setBpm(next.bpm);
    if (patch.visualOnly !== undefined || patch.mutedBars !== undefined)
      metronome.setSound({ visualOnly: next.visualOnly, mutedBars: next.mutedBars });
  };

  const setBpm = (bpm: number) => update({ bpm: clampBpm(bpm) });

  const toggle = async () => {
    if (running) {
      metronome.stop();
      return;
    }
    setEnded(false);
    await metronome.start({
      ...config,
      stopAfterBars: limit.kind === 'bars' ? limit.n : null,
      stopAfterS: limit.kind === 'minutes' ? limit.n * 60 : null,
    });
  };

  const beats = beatsPerBar(config.meter);
  const step = (d: number) => (
    <Button
      key={d}
      variant="secondary"
      large
      className="min-w-16"
      aria-label={d < 0 ? ko.metronome.decrease(-d) : ko.metronome.increase(d)}
      onClick={() => setBpm(config.bpm + d)}
    >
      {d > 0 ? `+${d}` : d}
    </Button>
  );
  return (
    <Screen title={ko.metronome.title} width="wide">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
        <section className="card flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          {/* Read from a music stand like a practice screen's tempo: a key number (UQ-3, 15–25 % of the height). */}
          <p className="flex items-baseline gap-2 leading-none" data-core-number>
            <span
              className="font-black tabular-nums tracking-tight"
              style={{ fontSize: 'clamp(2.75rem, 16vh, 13rem)' }}
              data-testid="metronome-bpm"
            >
              {config.bpm}
            </span>{' '}
            <span className="text-2xl font-bold text-muted">{ko.metronome.bpm}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[-5, -1].map(step)}
            {[1, 5].map(step)}
          </div>
          <input
            type="range"
            min={30}
            max={240}
            value={config.bpm}
            aria-label={ko.metronome.bpm}
            className="w-full"
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <div
            className="flex items-center justify-center gap-3"
            aria-hidden="true"
            data-testid="metronome-pulse"
          >
            {BEAT_NUMBERS.slice(0, beats).map((beat) => {
              const active = pulse !== null && pulse.beat === beat && pulse.sub === 0;
              const accent = beat === 0;
              return (
                <span
                  key={beat}
                  data-active={active}
                  className={`rounded-full ${accent ? 'size-11' : 'size-8'} ${active ? (pulse?.countIn ? 'bg-info' : 'bg-accent') : 'bg-surface-2'}`}
                />
              );
            })}
          </div>
          <p className="min-h-6 text-center text-muted" aria-live="off">
            {pulse
              ? pulse.countIn
                ? ko.metronome.countingIn
                : ko.metronome.barBeat(pulse.bar, pulse.beat)
              : ''}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div data-primary-action>
              <Button large className="min-w-32" onClick={() => void toggle()} data-testid="metronome-toggle">
                <Icon name={running ? 'pause' : 'play'} />
                {running ? ko.metronome.stop : ko.metronome.start}
              </Button>
            </div>
            <Button
              large
              variant="secondary"
              onClick={() => {
                const bpm = tap.current.tap(performance.now());
                if (bpm !== null) setBpm(bpm);
              }}
            >
              {ko.metronome.tap}
            </Button>
          </div>
          {ended && (
            <p className="text-center text-ok" role="status">
              {ko.metronome.ended}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="card grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-1 xl:grid-cols-2">
            <OptionSelect
              testId="metronome-meter"
              label={ko.metronome.meter}
              options={['4/4', '3/4', '6/8'] as Meter[]}
              value={config.meter}
              render={(m) => m}
              onChange={(meter) => update({ meter })}
            />
            <OptionSelect
              testId="metronome-subdivision"
              label={ko.metronome.subdivision}
              options={[1, 2, 3, 4] as Subdivision[]}
              value={config.subdivision}
              render={(s) => ko.metronome.subdivisionNames[s] ?? String(s)}
              onChange={(subdivision) => update({ subdivision })}
            />
            <OptionSelect
              testId="metronome-countin"
              label={ko.metronome.countIn}
              options={[0, 1, 2] as const}
              value={config.countInBars}
              render={ko.metronome.countInBars}
              onChange={(countInBars) => update({ countInBars })}
            />
            <OptionSelect
              testId="metronome-muted"
              label={ko.metronome.mutedBars}
              options={MUTED_OPTIONS}
              value={config.mutedBars}
              render={(m) => (m ? ko.metronome.mutedPattern(m.play, m.mute) : ko.metronome.mutedOff)}
              onChange={(mutedBars) => update({ mutedBars })}
            />
            <OptionSelect
              testId="metronome-limit"
              label={ko.metronome.limit}
              options={LIMIT_OPTIONS}
              value={limit}
              render={limitLabel}
              onChange={setLimit}
            />
            <Choice
              type="checkbox"
              label={ko.metronome.visualOnly}
              className="self-end"
              checked={config.visualOnly}
              onChange={(e) => update({ visualOnly: e.target.checked })}
            />
          </section>

          <section className="card rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="text-lg font-bold">{ko.metronome.ladder}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ['startBpm', ko.metronome.ladderStart],
                  ['targetBpm', ko.metronome.ladderTarget],
                  ['stepBpm', ko.metronome.ladderStep],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <TextInput
                    type="number"
                    min={key === 'stepBpm' ? 1 : 30}
                    max={key === 'stepBpm' ? 20 : 240}
                    value={ladder[key]}
                    className="w-full min-w-0"
                    onChange={(e) => setLadder({ ...ladder, [key]: Number(e.target.value) })}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setBpm(ladder.startBpm)}>
                {ko.metronome.ladderStart}
              </Button>
              <Button variant="secondary" onClick={() => setBpm(nextLadderBpm(ladder, config.bpm, true))}>
                {ko.metronome.ladderUp}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </Screen>
  );
}
