import { voicingById } from '../../content/voicings';
import { type QuizResult, RECALL_LIMIT_MS, type RecallResult } from '../../domain/exerciseResults';
import { stringNumber } from '../../domain/strings';
import { midiName, STANDARD_TUNING } from '../../domain/theory';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import { Icon } from '../../ui/icons';
import { Tab } from '../../ui/Tab';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { PRACTICE_DIAGRAM, PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import type { QuizView } from './choiceQuiz';
import type { DiagramPrompt, EarPrompt, OpenNotePrompt, TabPrompt } from './questions';
import type { Q2View } from './recall';

/**
 * The answers of the current question (keys 1/2/3…): one decision, the stage's next step (D-090). Once answered,
 * the verdict and "다음" follow the answers in the same region, so nothing above them moves after the tap.
 */
function choiceButtons<P>(runner: ExerciseRunner<QuizResult, QuizView<P>>, view: QuizView<P>) {
  const q = view.question;
  const answered = view.picked !== null;
  // A played-note question ("pluck", Q3) has no buttons: the region then holds only the verdict.
  if (!q || (q.options.length === 0 && !answered)) return undefined;
  return (
    <div className="flex w-full flex-col gap-2 sm:gap-3">
      {q.options.map((option, k) => {
        const right = answered && k === q.answer;
        const wrong = answered && k === view.picked && !right;
        return (
          <Button
            key={option}
            large
            align="start"
            variant="secondary"
            selected={right ? 'ok' : wrong ? 'fail' : null}
            className="w-full"
            onClick={() => runner.command((['manual1', 'manual2', 'manual3'] as const)[k]!)}
          >
            {k + 1}. {option}
            {(right || wrong) && (
              <span aria-hidden="true" className={`ml-auto text-2xl ${right ? 'text-ok' : 'text-fail'}`}>
                {right ? '✓' : '✗'}
              </span>
            )}
          </Button>
        );
      })}
      {answered && (
        <div aria-live="polite" className="mt-1 flex flex-wrap items-center gap-3">
          <p
            className={`text-xl font-semibold ${view.picked === q.answer ? 'text-ok' : 'text-fail'}`}
            data-testid="quiz-feedback"
          >
            {view.picked === q.answer
              ? ko.exercises.quiz.correct
              : ko.exercises.quiz.wrong(q.options[q.answer] ?? '')}
          </p>
          {view.lookingBack ? (
            <>
              <p className="w-full text-muted" data-testid="quiz-looking-back">
                {ko.exercises.quiz.lookingBack(view.index + 1)}
              </p>
              <Button onClick={() => runner.command('next')} data-testid="quiz-back-to-current">
                {ko.exercises.quiz.backToCurrent}
              </Button>
            </>
          ) : (
            <Button onClick={() => runner.command('next')}>{ko.exercises.quiz.next}</Button>
          )}
        </div>
      )}
    </div>
  );
}

/** ← in a quiz: a read-only look at the questions already answered (D-096). */
function lookBackButton<P>(runner: ExerciseRunner<QuizResult, QuizView<P>>, view: QuizView<P>) {
  if (view.lookingBack || !(runner.canStepBack?.() ?? false)) return undefined;
  return (
    <Button variant="secondary" onClick={() => runner.command('prev')} data-testid="quiz-look-back">
      {ko.exercises.quiz.lookBack}
    </Button>
  );
}

/** Where the quiz is (question n of 10). */
function QuizProgress<P>({ view }: { view: QuizView<P> }) {
  return (
    <p className="text-lg text-muted tabular-nums">
      {ko.exercises.quiz.progress(view.index + 1, view.total)}
    </p>
  );
}

function keysHint(options: number) {
  return <p className="text-muted">{ko.exercises.quiz.keysHint(options)}</p>;
}

export function Q1View({
  runner,
  ctx,
}: {
  runner: ExerciseRunner<QuizResult, QuizView<DiagramPrompt>>;
  params: unknown;
  ctx: ExerciseContext;
}) {
  const { view } = useRunnerSnapshot(runner);
  const q = view.question;
  if (!q) return null;
  const voicing = voicingById(q.prompt.voicingId);
  return (
    <PracticeStage
      data-testid="q1-view"
      stickyActions={false}
      figure={
        <>
          <p className="self-stretch text-2xl font-semibold">
            {q.prompt.kind === 'position'
              ? ko.exercises.q1.positionPrompt
              : ko.exercises.q1.symbolPrompt(stringNumber(q.prompt.idx))}
          </p>
          <ChordDiagram
            voicing={voicing}
            leftHanded={ctx.settings.leftHanded}
            activeIdx={q.prompt.kind === 'symbol' ? q.prompt.idx : null}
            highlight={q.prompt.kind === 'position' ? { idx: q.prompt.idx, fret: q.prompt.fret } : null}
            className={PRACTICE_DIAGRAM}
          />
        </>
      }
      primary={choiceButtons(runner, view)}
      secondary={lookBackButton(runner, view)}
      notes={keysHint(q.options.length)}
    >
      <QuizProgress view={view} />
    </PracticeStage>
  );
}

export function Q3View({
  runner,
}: {
  runner: ExerciseRunner<QuizResult, QuizView<OpenNotePrompt>>;
  params: unknown;
  ctx: ExerciseContext;
}) {
  const { view } = useRunnerSnapshot(runner);
  const q = view.question;
  if (!q) return null;
  const openName = (idx: number) => midiName(STANDARD_TUNING.openMidi[idx]!).replace(/\d+$/, '');
  return (
    <PracticeStage
      data-testid="q3-view"
      stickyActions={false}
      figure={
        <p
          className="w-full rounded-2xl bg-surface p-6 text-3xl font-bold lg:p-8 lg:text-4xl"
          data-testid="q3-prompt"
          data-idx={q.prompt.idx}
          data-fret={q.prompt.fret}
        >
          {q.prompt.fret === 0 && q.prompt.kind === 'name'
            ? ko.exercises.q3.namePrompt(stringNumber(q.prompt.idx))
            : q.prompt.kind === 'name'
              ? ko.exercises.q3.positionNamePrompt(stringNumber(q.prompt.idx), q.prompt.fret)
              : q.prompt.fret === 0
                ? ko.exercises.q3.pluckPrompt(openName(q.prompt.idx))
                : ko.exercises.q3.positionPluckPrompt(
                    stringNumber(q.prompt.idx),
                    midiName(STANDARD_TUNING.openMidi[q.prompt.idx]! + q.prompt.fret).replace(/\d+$/, ''),
                  )}
        </p>
      }
      primary={choiceButtons(runner, view)}
      secondary={lookBackButton(runner, view)}
      notes={keysHint(q.options.length)}
    >
      <QuizProgress view={view} />
    </PracticeStage>
  );
}

export function Q4View({
  runner,
}: {
  runner: ExerciseRunner<QuizResult, QuizView<EarPrompt>>;
  params: unknown;
  ctx: ExerciseContext;
}) {
  const { view } = useRunnerSnapshot(runner);
  if (!view.question) return null;
  return (
    <PracticeStage
      data-testid="q4-view"
      stickyActions={false}
      figure={
        <div className="flex w-full flex-col gap-3 rounded-2xl bg-surface p-4 lg:gap-4 lg:p-8">
          <p
            className="text-xl font-semibold lg:text-2xl"
            data-testid="q4-prompt"
            data-kind={view.question.prompt.kind}
          >
            {ko.exercises.q4.prompts[view.question.prompt.kind]}
          </p>
          <Button large variant="secondary" className="self-start" onClick={() => runner.command('mark')}>
            <Icon name="play" />
            {ko.exercises.q4.replay}
          </Button>
        </div>
      }
      primary={choiceButtons(runner, view)}
      secondary={lookBackButton(runner, view)}
      notes={keysHint(view.question.options.length)}
    >
      <QuizProgress view={view} />
    </PracticeStage>
  );
}

export function QuizSummary({ result }: { result: QuizResult; params: unknown }) {
  return (
    <div data-testid="quiz-summary">
      <p className={RESULT_HEADLINE}>{ko.exercises.quiz.score(result.correct, result.questions)}</p>
      {result.meanReactionMs !== null && <p>{ko.exercises.quiz.reaction(result.meanReactionMs)}</p>}
    </div>
  );
}

export function Q2ViewComponent({
  runner,
}: {
  runner: ExerciseRunner<RecallResult, Q2View>;
  params: unknown;
  ctx: ExerciseContext;
}) {
  const { view } = useRunnerSnapshot(runner);
  return (
    <PracticeStage
      data-testid="q2-view"
      figure={
        <p
          className="flex min-h-[30vh] w-full items-center justify-center rounded-2xl bg-surface font-bold"
          style={{ fontSize: 'clamp(3rem, 20vh, 10rem)' }}
        >
          {view.chordClass ?? ''}
        </p>
      }
      primary={
        view.self ? (
          <>
            <Button large onClick={() => runner.command('manual1')}>
              1 {ko.exercises.q2.self.manual1}
            </Button>
            <Button large variant="secondary" onClick={() => runner.command('manual2')}>
              2 {ko.exercises.q2.self.manual2}
            </Button>
          </>
        ) : undefined
      }
    >
      <p className="text-lg text-muted tabular-nums">
        {ko.exercises.quiz.progress(Math.min(view.index + 1, view.total), view.total)}
      </p>
      <p className="min-h-10 text-3xl font-bold tabular-nums">
        {view.countdown > 0 ? ko.exercises.q2.countdown(view.countdown) : ''}
      </p>
      <p className="text-xl">{view.chordClass ? ko.exercises.q2.prompt(view.chordClass) : ''}</p>
      <div aria-live="polite" className="min-h-7 text-xl">
        {view.heard && <p>{ko.exercises.q2.heard(view.heard)}</p>}
      </div>
    </PracticeStage>
  );
}

export function Q2Summary({ result }: { result: RecallResult; params: unknown }) {
  const passed = result.items.filter(
    (i) => i.correct && i.reactionMs !== null && i.reactionMs <= RECALL_LIMIT_MS,
  ).length;
  return (
    <p className={RESULT_HEADLINE} data-testid="q2-summary">
      {ko.exercises.q2.passed(passed, result.items.length)}
    </p>
  );
}

export function Q5View({
  runner,
}: {
  runner: ExerciseRunner<QuizResult, QuizView<TabPrompt>>;
  params: unknown;
  ctx: ExerciseContext;
}) {
  const { view } = useRunnerSnapshot(runner);
  const q = view.question;
  if (!q) return null;
  return (
    <PracticeStage
      data-testid="q5-view"
      stickyActions={false}
      figure={
        <div className="flex w-full flex-col gap-4">
          <p className="rounded-xl bg-surface p-4 text-muted">{ko.exercises.q5.topLine}</p>
          {q.prompt.kind === 'tabToPos' ? (
            <>
              <p className="text-2xl font-semibold">{ko.exercises.q5.tabToPosPrompt}</p>
              <div className="w-48 self-center lg:w-64">
                <Tab
                  notes={[{ string: q.prompt.string, fret: q.prompt.fret }]}
                  current={0}
                  label={ko.exercises.q5.tabCell(q.prompt.string, q.prompt.fret)}
                />
              </div>
            </>
          ) : (
            <p className="text-3xl font-bold">
              {ko.exercises.q5.posToTabPrompt(q.prompt.string, q.prompt.fret)}
            </p>
          )}
        </div>
      }
      primary={choiceButtons(runner, view)}
      secondary={lookBackButton(runner, view)}
      notes={keysHint(q.options.length)}
    >
      <QuizProgress view={view} />
    </PracticeStage>
  );
}
