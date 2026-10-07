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

function Select<T>({
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <select
        data-testid={testId}
        className="min-h-12 rounded-lg bg-surface-2 px-3 text-base text-fg"
        value={index}
        onChange={(e) => onChange(options[Number(e.target.value)]!)}
      >
        {options.map((o, i) => (
          <option key={render(o)} value={i}>
            {render(o)}
          </option>
        ))}
      </select>
    </label>
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
  return (
    <Screen title={ko.metronome.title}>
      <section className="rounded-lg bg-surface p-4">
        <div className="flex items-center justify-center gap-2">
          {[-5, -1].map((d) => (
            <Button
              key={d}
              variant="secondary"
              large
              aria-label={ko.metronome.decrease(-d)}
              onClick={() => setBpm(config.bpm + d)}
            >
              {d}
            </Button>
          ))}
          <p className="min-w-28 text-center">
            <span className="block text-5xl font-bold tabular-nums" data-testid="metronome-bpm">
              {config.bpm}
            </span>
            <span className="text-sm text-muted">{ko.metronome.bpm}</span>
          </p>
          {[1, 5].map((d) => (
            <Button
              key={d}
              variant="secondary"
              large
              aria-label={ko.metronome.increase(d)}
              onClick={() => setBpm(config.bpm + d)}
            >
              +{d}
            </Button>
          ))}
        </div>
        <input
          type="range"
          min={30}
          max={240}
          value={config.bpm}
          aria-label={ko.metronome.bpm}
          className="mt-4 w-full"
          onChange={(e) => setBpm(Number(e.target.value))}
        />
        <div className="mt-4 flex justify-center gap-2" aria-hidden="true" data-testid="metronome-pulse">
          {BEAT_NUMBERS.slice(0, beats).map((beat) => {
            const active = pulse !== null && pulse.beat === beat && pulse.sub === 0;
            const accent = beat === 0;
            return (
              <span
                key={beat}
                data-active={active}
                className={`rounded-full ${accent ? 'h-10 w-10' : 'h-7 w-7'} ${active ? (pulse?.countIn ? 'bg-info' : 'bg-accent') : 'bg-surface-2'}`}
              />
            );
          })}
        </div>
        <p className="mt-2 text-center text-sm text-muted" aria-live="off">
          {pulse
            ? pulse.countIn
              ? ko.metronome.countingIn
              : ko.metronome.barBeat(pulse.bar, pulse.beat)
            : ''}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button large onClick={() => void toggle()} data-testid="metronome-toggle">
            {running ? ko.metronome.stop : ko.metronome.start}
          </Button>
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
          <p className="mt-2 text-center text-ok" role="status">
            {ko.metronome.ended}
          </p>
        )}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          testId="metronome-meter"
          label={ko.metronome.meter}
          options={['4/4', '3/4', '6/8'] as Meter[]}
          value={config.meter}
          render={(m) => m}
          onChange={(meter) => update({ meter })}
        />
        <Select
          testId="metronome-subdivision"
          label={ko.metronome.subdivision}
          options={[1, 2, 3, 4] as Subdivision[]}
          value={config.subdivision}
          render={(s) => ko.metronome.subdivisionNames[s] ?? String(s)}
          onChange={(subdivision) => update({ subdivision })}
        />
        <Select
          testId="metronome-countin"
          label={ko.metronome.countIn}
          options={[0, 1, 2] as const}
          value={config.countInBars}
          render={ko.metronome.countInBars}
          onChange={(countInBars) => update({ countInBars })}
        />
        <Select
          testId="metronome-muted"
          label={ko.metronome.mutedBars}
          options={MUTED_OPTIONS}
          value={config.mutedBars}
          render={(m) => (m ? ko.metronome.mutedPattern(m.play, m.mute) : ko.metronome.mutedOff)}
          onChange={(mutedBars) => update({ mutedBars })}
        />
        <Select
          testId="metronome-limit"
          label={ko.metronome.limit}
          options={LIMIT_OPTIONS}
          value={limit}
          render={limitLabel}
          onChange={setLimit}
        />
        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={config.visualOnly}
            onChange={(e) => update({ visualOnly: e.target.checked })}
          />
          <span>{ko.metronome.visualOnly}</span>
        </label>
      </section>

      <section className="mt-4 rounded-lg bg-surface p-4">
        <h2 className="font-semibold">{ko.metronome.ladder}</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              ['startBpm', ko.metronome.ladderStart],
              ['targetBpm', ko.metronome.ladderTarget],
              ['stepBpm', ko.metronome.ladderStep],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{label}</span>
              <input
                type="number"
                min={key === 'stepBpm' ? 1 : 30}
                max={key === 'stepBpm' ? 20 : 240}
                value={ladder[key]}
                className="min-h-12 rounded-lg bg-surface-2 px-3 text-base text-fg"
                onChange={(e) => setLadder({ ...ladder, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={() => setBpm(ladder.startBpm)}>
            {ko.metronome.ladderStart}
          </Button>
          <Button onClick={() => setBpm(nextLadderBpm(ladder, config.bpm, true))}>
            {ko.metronome.ladderUp}
          </Button>
        </div>
      </section>
    </Screen>
  );
}
