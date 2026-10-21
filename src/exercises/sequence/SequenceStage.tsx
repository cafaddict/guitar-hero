/**
 * Shared screen of the sequence exercises (E9, E10, E11, E17): TAB with the note due now, cycle count and
 * flawless streak, self-report buttons without a microphone, and the last cycle's faults as coaching hints
 * (position and semitone difference of the first wrong note, SPEC v1.1 §6.7, E2E-16).
 */
import type { ReactNode } from 'react';
import { sequenceHints } from '../../domain/coaching';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Phrases } from '../../ui/Phrases';
import { Tab } from '../../ui/Tab';
import type { ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { PracticeStage } from '../ui/PracticeStage';
import { TempoPick } from '../ui/TempoPick';
import type { SequenceView } from './runner';

export function SequenceStage<R, V extends SequenceView>({
  runner,
  title,
  tabLabel,
  testId,
  barSize,
  children,
  status,
  primary,
  primaryLabel,
  secondary,
  words,
}: {
  runner: ExerciseRunner<R, V>;
  title: string;
  tabLabel: string;
  testId: string;
  /** Notes per bar, for bar lines in the TAB (riffs). */
  barSize?: number;
  /** How to play it (the stage's notes). */
  children?: ReactNode;
  /** Extra live lines under the cycle status (legato reading, speaker reference). */
  status?: ReactNode;
  /** The next step when the view asks something of its own (E11's evenness rating). */
  primary?: ReactNode;
  /** The question that `primary` answers. */
  primaryLabel?: string | undefined;
  /** Controls of the view beside the next step (들어 보기, earphones). */
  secondary?: ReactNode;
  /** The TAB in words before the run (riffs): first of the notes, beside the status on a wide screen. */
  words?: ReactNode;
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
  const playing = phase === 'running' || phase === 'countIn';
  return (
    <PracticeStage
      data-testid={testId}
      data-phase={phase}
      figureSpan="full"
      figure={
        <div className="flex w-full flex-col items-center gap-2">
          <p className="self-start text-3xl font-bold tabular-nums">
            <Phrases text={`${title} · ${t.bpm(view.bpm)}`} />
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
          <p className="self-start text-muted">{t.tabTopLine}</p>
        </div>
      }
      primary={
        primary !== undefined ? (
          primary
        ) : phase === 'ready' ? (
          // Space starts it too; the button is the touch way in (an iPad on a music stand, SPEC §4.2).
          <Button large onClick={() => runner.command('toggle')} data-testid="seq-start">
            {ko.common.start}
          </Button>
        ) : view.source === 'self' && phase === 'running' ? (
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
        ) : undefined
      }
      primaryLabel={primaryLabel}
      secondary={secondary}
      tools={
        // The tempo is picked before the start (D-098); the TAB and finish controls belong to the run.
        phase === 'ready' && view.tempoPickable ? (
          <TempoPick onPick={(cmd) => runner.command(cmd)} />
        ) : (
          playing && (
            <>
              <Button variant="secondary" onClick={() => runner.command('hide')} data-testid="seq-hide">
                {view.tabHidden ? t.showTab : t.hideTab}
              </Button>
              <Button variant="secondary" onClick={() => runner.command('toggle')} data-testid="seq-finish">
                {t.finish}
              </Button>
            </>
          )
        )
      }
      notes={
        <>
          {phase === 'ready' && view.tempoPickable && (
            <p className="text-muted">{ko.exercises.common.tempoPickNote}</p>
          )}
          {words}
          {children}
          <p className="text-muted">{view.source === 'mic' ? t.micNote : t.selfNote}</p>
        </>
      }
    >
      {phase === 'ready' && <p className="text-xl">{view.source === 'mic' ? t.readyMic : t.readySelf}</p>}
      {view.countIn && (
        <p aria-live="polite" className="text-xl font-semibold">
          {t.countIn}
        </p>
      )}
      {(playing || phase === 'review' || phase === 'done' || phase === 'paused') && (
        <p
          aria-live="polite"
          className="text-xl tabular-nums"
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
          className="flex flex-col gap-1 text-lg"
          data-testid="seq-last"
          data-flawless={last.flawless}
          data-uncertain={last.uncertain}
          data-fault-position={firstWrong ? firstWrong.index + 1 : ''}
          data-fault-semitones={firstWrong?.semitones ?? ''}
        >
          <p
            className={`flex items-center gap-2 font-semibold ${last.flawless ? 'text-ok' : last.uncertain ? 'text-muted' : 'text-retry'}`}
          >
            <span aria-hidden="true">{last.flawless ? '✓' : last.uncertain ? '–' : '!'}</span>
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
      {view.analyzing && (
        <p aria-live="polite" className="text-lg">
          {t.analyzing}
        </p>
      )}
      {status}
    </PracticeStage>
  );
}
