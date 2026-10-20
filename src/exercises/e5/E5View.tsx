import { patternById, type StrumSlot } from '../../content/patterns';
import type { StrumResult } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { ArmedStart } from '../ui/ArmedStart';
import { BigBpm } from '../ui/BigBpm';
import { BigTimer } from '../ui/BigTimer';
import { useRunnerSnapshot } from '../ui/hooks';
import { LiveBars } from '../ui/LiveBars';
import { type E5Beta, type E5Params, nextBpmFor, type E5View as View } from './runner';

/** A slot's identity is its position in the bar (patterns repeat 'D'/'U' symbols). */
const toSlotCell = (slot: StrumSlot, position: number) => ({ slot, position });

/** Beat numbers 1–4 (6/8: 1–2) in large type, the current one highlighted (SPEC v1.1 §11.6, research 01:307). */
function BeatCount({ beat, beatsPerBar }: { beat: number | null; beatsPerBar: number }) {
  return (
    <ol
      className="flex justify-center gap-3"
      aria-hidden="true"
      data-testid="e5-beats"
      data-beat={beat ?? ''}
    >
      {Array.from({ length: beatsPerBar }, (_, i) => i + 1).map((n) => (
        <li
          key={n}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-4xl font-black ${n === beat ? 'bg-accent text-accent-fg' : 'bg-surface text-muted'}`}
        >
          {n}
        </li>
      ))}
    </ol>
  );
}

export function E5ViewComponent({
  runner,
  ctx,
}: {
  runner: ExerciseRunner<StrumResult, View>;
  params: E5Params;
  ctx: ExerciseContext;
}) {
  const { view, phase, remainingMs } = useRunnerSnapshot(runner);
  const chord = view.chords.length > 0 ? view.chords[(view.bar ?? 0) % view.chords.length] : null;
  const live = view.source === 'mic' && phase !== 'armed' && phase !== 'ready' && phase !== 'done';
  /** The bar judged last: its slot verdicts are shown under the pattern cells. */
  const lastBar = view.liveBars[view.liveBars.length - 1] ?? null;
  return (
    <div className="flex flex-col gap-4" data-testid="e5-view" data-phase={phase}>
      <BigTimer remainingMs={remainingMs} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <BigBpm bpm={view.bpm} />
        <p className="text-lg" data-testid="e5-bar">
          {phase === 'countIn'
            ? ko.exercises.e5.countIn
            : view.bar !== null
              ? ko.exercises.e5.bar(view.bar + 1, view.bars)
              : ''}
        </p>
        {chord && <p className="text-3xl font-bold">{chord}</p>}
      </div>
      <ol
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${view.pattern.slots.length}, minmax(0, 1fr))` }}
        aria-label={view.pattern.label}
      >
        {view.pattern.slots.map(toSlotCell).map(({ slot, position }) => {
          const active = !view.cuesHidden && view.slot === position;
          const accent = view.pattern.accents.includes(position);
          return (
            <li
              key={position}
              className={`flex min-h-16 flex-col items-center justify-center rounded-lg ${active ? 'bg-accent text-accent-fg' : 'bg-surface'} ${accent ? 'font-black' : ''}`}
            >
              <span className="text-3xl" aria-hidden="true">
                {view.cuesHidden ? '' : ko.exercises.e5.direction[slot]}
              </span>
              <span className="text-xs">{view.cuesHidden ? '' : ko.exercises.e5.directionLabel[slot]}</span>
              {live && lastBar && (
                <span
                  className={`text-sm font-bold ${{ hit: 'text-ok', miss: 'text-fail', extra: 'text-retry', empty: '' }[lastBar.judgements[position] ?? 'empty']}`}
                  data-testid="e5-slot-judgement"
                  data-judgement={lastBar.judgements[position] ?? 'empty'}
                  aria-hidden="true"
                >
                  {ko.exercises.live.slot[lastBar.judgements[position] ?? 'empty']}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <BeatCount beat={view.beat} beatsPerBar={view.beatsPerBar} />
      {live && <LiveBars bars={view.bars} live={view.liveBars} current={view.bar} kind="counts" />}
      <p className="text-center" data-testid="e5-count-hint">
        {ko.exercises.e5.countAloud}
        {ctx.content.stage === 2 && ` ${ko.exercises.e5.footTap}`}
      </p>
      {view.dynamics && (
        <p className="text-center text-2xl font-bold" data-testid="e5-dynamics" data-soft={view.soft ?? ''}>
          {view.soft === null
            ? ko.exercises.e5.dynamicsHow
            : view.soft
              ? ko.exercises.e5.soft
              : ko.exercises.e5.loud}
        </p>
      )}
      {view.cuesHidden && <p className="text-sm text-muted">{ko.exercises.e5.cuesHidden}</p>}
      <p className="text-sm text-muted">{ko.exercises.e5.optionKeys}</p>
      <p className="text-sm text-muted">
        {ko.exercises.e5.modes[view.mode]} · {ko.exercises.e5.keepGoing} {ko.exercises.e5.directionNote}
      </p>
      <ArmedStart phase={phase} onStart={() => runner.command('toggle')} />
      <div aria-live="polite">
        {view.analyzing && <p>{ko.exercises.e5.analyzing}</p>}
        {view.analysisFailed && <p className="text-retry">{ko.exercises.e5.analysisFailed}</p>}
        {view.awaitingDynamics && (
          <div data-testid="e5-dynamics-rating">
            <p>{ko.exercises.e5.dynamicsPrompt}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
                <Button key={cmd} large variant="secondary" onClick={() => runner.command(cmd)}>
                  {k + 1} {ko.exercises.e5.dynamicsSelf[cmd]}
                </Button>
              ))}
            </div>
          </div>
        )}
        {view.awaitingSelf && (
          <div>
            <p>{ko.exercises.e5.selfPrompt}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
                <Button key={cmd} large variant="secondary" onClick={() => runner.command(cmd)}>
                  {k + 1} {ko.exercises.e5.self[cmd]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Beta readings, labelled "참고(베타)" (SPEC v1.1 §10.11): never a score. */
function BetaLines({ beta }: { beta: E5Beta }) {
  const t = ko.exercises.e5.beta;
  return (
    <div className="mt-2 text-sm text-muted" data-testid="e5-beta" data-beta="true">
      <p>{t.direction(beta.direction.down, beta.direction.up, beta.direction.unknown)}</p>
      {beta.palmMuteShare !== undefined && <p>{t.palmMute(beta.palmMuteShare)}</p>}
      {beta.dynamics && <p>{t.dynamics(beta.dynamics.map((d) => t.bar[d]).join(' '))}</p>}
    </div>
  );
}

export function E5Summary({ result }: { result: StrumResult; params: E5Params }) {
  const next = nextBpmFor(result.bpm, result.ladder);
  return (
    <div data-testid="e5-summary">
      <p className="text-xl font-bold">{patternById(result.patternId).label}</p>
      <p className="text-3xl font-bold" data-testid="e5-hit-rate" data-value={result.hitRate}>
        {ko.exercises.e5.hitRate(result.hitRate)}
      </p>
      {result.hitRateCorrected !== result.hitRate && (
        <p>{ko.exercises.e5.corrected(result.hitRateCorrected)}</p>
      )}
      <p>{ko.exercises.e5.counts(result.hits, result.misses, result.extras)}</p>
      {result.meanOffsetMs !== null && (
        <p data-testid="e5-mean" data-value={result.meanOffsetMs}>
          {ko.exercises.e5.mean(result.meanOffsetMs)}
        </p>
      )}
      {result.sdOffsetMs !== null && (
        <p data-testid="e5-sd" data-value={result.sdOffsetMs}>
          {ko.exercises.e5.sd(result.sdOffsetMs)}
        </p>
      )}
      {result.beta !== undefined && <BetaLines beta={result.beta as unknown as E5Beta} />}
      <p
        className="mt-2 text-lg font-semibold"
        data-testid="e5-ladder"
        data-ladder={result.ladder}
        data-next-bpm={next}
      >
        {ko.exercises.e5.ladder[result.ladder](next)}
      </p>
      {(result.pauses ?? 0) > 0 && <p className="text-muted">{ko.exercises.common.pausedRun}</p>}
    </div>
  );
}
