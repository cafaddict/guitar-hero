/**
 * Shared screen of the sequence exercises (E9, E10, E11, E17): TAB with the note due now, cycle count and
 * flawless streak, self-report buttons without a microphone, and the last cycle's faults as coaching hints
 * (position and semitone difference of the first wrong note, SPEC v1.1 §6.7, E2E-16).
 */
import type { ReactNode } from 'react';
import { sequenceHints } from '../../domain/coaching';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Tab } from '../../ui/Tab';
import type { ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import type { SequenceView } from './runner';

export function SequenceStage<R, V extends SequenceView>({
  runner,
  title,
  tabLabel,
  testId,
  barSize,
  children,
}: {
  runner: ExerciseRunner<R, V>;
  title: string;
  tabLabel: string;
  testId: string;
  /** Notes per bar, for bar lines in the TAB (riffs). */
  barSize?: number;
  children?: ReactNode;
}) {
  const { view, phase } = useRunnerSnapshot(runner);
  const t = ko.exercises.sequence;
  const flawless = view.cycles.filter((c) => c.flawless).length;
  const last = view.cycles.at(-1);
  // The last cycle's notes with their verdicts (OK unless listed as a fault) → coaching hints.
  const lastHints =
    last?.faults && view.lastCycleNotes
      ? sequenceHints(
          view.lastCycleNotes.map((note, index) => {
            const fault = last.faults?.find((f) => f.index === index);
            return {
              string: note.string,
              fret: note.fret,
              status: fault?.status ?? 'OK',
              ...(fault?.semitones === undefined ? {} : { semitones: fault.semitones }),
            };
          }),
        )
      : [];
  const firstWrong = last?.faults?.find((f) => f.status === 'WRONG_NOTE');
  return (
    <section className="flex flex-col gap-3" data-testid={testId} data-phase={phase}>
      <p className="text-3xl font-bold tabular-nums">
        {title} · {t.bpm(view.bpm)}
      </p>
      <Tab
        notes={view.cycleNotes.map((n) => ({ string: n.string, fret: n.fret }))}
        current={view.noteIndex}
        hidden={view.tabHidden}
        label={tabLabel}
        {...(barSize ? { barSize } : {})}
        {...(view.cycleNotes.some((n) => n.finger !== undefined)
          ? { fingers: view.cycleNotes.map((n) => n.finger ?? 0) }
          : {})}
      />
      <p className="text-sm text-muted">{t.tabTopLine}</p>
      {children}
      <p className="text-sm text-muted">{view.source === 'mic' ? t.micNote : t.selfNote}</p>
      {phase === 'ready' && <p>{view.source === 'mic' ? t.readyMic : t.readySelf}</p>}
      {view.countIn && <p aria-live="polite">{t.countIn}</p>}
      {(phase === 'running' || phase === 'countIn' || phase === 'review' || phase === 'done') && (
        <p
          aria-live="polite"
          data-testid="seq-cycles"
          data-streak={view.streak}
          data-count={view.cycles.length}
        >
          {t.cycles(view.cycles.length, flawless, view.streak)}
        </p>
      )}
      {last && (
        <div
          aria-live="polite"
          data-testid="seq-last"
          data-flawless={last.flawless}
          data-uncertain={last.uncertain}
          data-fault-position={firstWrong ? firstWrong.index + 1 : ''}
          data-fault-semitones={firstWrong?.semitones ?? ''}
        >
          <p className={last.flawless ? 'text-ok' : last.uncertain ? 'text-muted' : 'text-retry'}>
            {last.flawless
              ? t.lastCycle.flawless
              : last.uncertain
                ? t.lastCycle.uncertain
                : t.lastCycle.mistake}
          </p>
          {(last.extras ?? 0) > 0 && <p>{t.extra(last.extras ?? 0)}</p>}
          {lastHints.map((hint) => (
            <p key={hint.code} data-testid="seq-hint">
              {ko.coaching.render(hint)}
            </p>
          ))}
        </div>
      )}
      {view.analyzing && <p aria-live="polite">{t.analyzing}</p>}
      {(phase === 'running' || phase === 'countIn') && (
        <div className="flex flex-wrap gap-2">
          {view.source === 'self' && phase === 'running' && (
            <>
              <Button large onClick={() => runner.command('manual1')} data-testid="seq-flawless">
                {t.flawless}
              </Button>
              <Button
                large
                variant="secondary"
                onClick={() => runner.command('manual2')}
                data-testid="seq-mistake"
              >
                {t.mistake}
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => runner.command('hide')} data-testid="seq-hide">
            {view.tabHidden ? t.showTab : t.hideTab}
          </Button>
          <Button variant="secondary" onClick={() => runner.command('toggle')} data-testid="seq-finish">
            {t.finish}
          </Button>
        </div>
      )}
    </section>
  );
}
