import { patternById, type StrumSlot } from '../../content/patterns';
import type { StrumResult } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Phrases } from '../../ui/Phrases';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { ArmedPrompt, armedStartButton } from '../ui/ArmedStart';
import { BigBpm } from '../ui/BigBpm';
import { BigTimer } from '../ui/BigTimer';
import { useRunnerSnapshot } from '../ui/hooks';
import { LiveBars } from '../ui/LiveBars';
import { PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
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
  const rating = (labels: Record<'manual1' | 'manual2' | 'manual3', string>) =>
    (['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
      <Button key={cmd} large variant="secondary" onClick={() => runner.command(cmd)}>
        {k + 1} {labels[cmd]}
      </Button>
    ));
  return (
    <PracticeStage
      data-testid="e5-view"
      data-phase={phase}
      figure={
        <div className="flex w-full flex-col gap-4">
          <ol
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${view.pattern.slots.length}, minmax(0, 1fr))` }}
            aria-label={view.pattern.label}
          >
            {view.pattern.slots.map(toSlotCell).map(({ slot, position }) => {
              const active = !view.cuesHidden && view.slot === position;
              const accent = view.pattern.accents.includes(position);
              return (
                <li
                  key={position}
                  className={`flex min-h-20 flex-col items-center justify-center rounded-xl ${active ? 'bg-accent text-accent-fg' : 'bg-surface'} ${accent ? 'font-black' : ''}`}
                >
                  <span className="text-4xl" aria-hidden="true">
                    {view.cuesHidden ? '' : ko.exercises.e5.direction[slot]}
                  </span>
                  <span className="text-sm">
                    {view.cuesHidden ? '' : ko.exercises.e5.directionLabel[slot]}
                  </span>
                  {live && lastBar && (
                    <span
                      className={`text-base font-bold ${{ hit: 'text-ok', miss: 'text-fail', extra: 'text-retry', empty: '' }[lastBar.judgements[position] ?? 'empty']}`}
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
          <p className="text-center text-lg" data-testid="e5-count-hint">
            {ko.exercises.e5.countAloud}
            {ctx.content.stage === 2 && ` ${ko.exercises.e5.footTap}`}
          </p>
          {view.dynamics && (
            <p
              className="text-center text-2xl font-bold"
              data-testid="e5-dynamics"
              data-soft={view.soft ?? ''}
            >
              {view.soft === null
                ? ko.exercises.e5.dynamicsHow
                : view.soft
                  ? ko.exercises.e5.soft
                  : ko.exercises.e5.loud}
            </p>
          )}
          {live && <LiveBars bars={view.bars} live={view.liveBars} current={view.bar} kind="counts" />}
        </div>
      }
      primary={
        armedStartButton(phase, () => runner.command('toggle')) ??
        (view.awaitingDynamics
          ? rating(ko.exercises.e5.dynamicsSelf)
          : view.awaitingSelf
            ? rating(ko.exercises.e5.self)
            : undefined)
      }
      primaryLabel={
        view.awaitingDynamics
          ? ko.exercises.e5.dynamicsPrompt
          : view.awaitingSelf
            ? ko.exercises.e5.selfPrompt
            : undefined
      }
      notes={
        <>
          {view.cuesHidden && <p className="text-muted">{ko.exercises.e5.cuesHidden}</p>}
          <p className="text-muted">
            {ko.exercises.e5.modes[view.mode]} · {ko.exercises.e5.keepGoing} {ko.exercises.e5.directionNote}
          </p>
          <p className="text-muted">
            <Phrases text={ko.exercises.e5.optionKeys} />
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <BigBpm bpm={view.bpm} />
        <BigTimer remainingMs={remainingMs} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-xl" data-testid="e5-bar">
          {phase === 'countIn'
            ? ko.exercises.e5.countIn
            : view.bar !== null
              ? ko.exercises.e5.bar(view.bar + 1, view.bars)
              : ''}
        </p>
        {chord && <p className="text-4xl font-bold">{chord}</p>}
      </div>
      <ArmedPrompt phase={phase} />
      <div aria-live="polite" className="text-xl">
        {view.analyzing && <p>{ko.exercises.e5.analyzing}</p>}
        {view.analysisFailed && <p className="text-retry">{ko.exercises.e5.analysisFailed}</p>}
        {view.awaitingDynamics && <p data-testid="e5-dynamics-rating">{ko.exercises.e5.dynamicsPrompt}</p>}
        {view.awaitingSelf && <p>{ko.exercises.e5.selfPrompt}</p>}
      </div>
    </PracticeStage>
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
      <p className={RESULT_HEADLINE}>{patternById(result.patternId).label}</p>
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
