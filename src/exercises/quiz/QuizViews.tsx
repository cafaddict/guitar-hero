import { voicingById } from '../../content/voicings';
import { type QuizResult, RECALL_LIMIT_MS, type RecallResult } from '../../domain/exerciseResults';
import { stringNumber } from '../../domain/strings';
import { midiName, STANDARD_TUNING } from '../../domain/theory';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import type { QuizView } from './choiceQuiz';
import type { DiagramPrompt, EarPrompt, OpenNotePrompt } from './questions';
import type { Q2View } from './recall';

function Choices<P>({
  runner,
  view,
}: {
  runner: ExerciseRunner<QuizResult, QuizView<P>>;
  view: QuizView<P>;
}) {
  const q = view.question;
  if (!q || q.options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {q.options.map((option, k) => {
        const answered = view.picked !== null;
        const tone =
          answered && k === q.answer ? 'bg-ok/30' : answered && k === view.picked ? 'bg-fail/30' : '';
        return (
          <Button
            key={option}
            large
            variant="secondary"
            className={`text-left ${tone}`}
            onClick={() => runner.command((['manual1', 'manual2', 'manual3'] as const)[k]!)}
          >
            {k + 1}. {option}
          </Button>
        );
      })}
    </div>
  );
}

function Feedback<P>({
  view,
  runner,
}: {
  view: QuizView<P>;
  runner: ExerciseRunner<QuizResult, QuizView<P>>;
}) {
  const q = view.question;
  if (!q || view.picked === null)
    return <p className="min-h-6 text-sm text-muted">{ko.exercises.quiz.keysHint}</p>;
  const right = view.picked === q.answer;
  return (
    <div aria-live="polite" className="flex items-center gap-3">
      <p className={right ? 'text-ok' : 'text-fail'} data-testid="quiz-feedback">
        {right ? ko.exercises.quiz.correct : ko.exercises.quiz.wrong(q.options[q.answer] ?? '')}
      </p>
      <Button variant="secondary" onClick={() => runner.command('next')}>
        {ko.exercises.quiz.next}
      </Button>
    </div>
  );
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
    <div className="grid gap-4 md:grid-cols-2" data-testid="q1-view">
      <ChordDiagram
        voicing={voicing}
        leftHanded={ctx.settings.leftHanded}
        activeIdx={q.prompt.kind === 'symbol' ? q.prompt.idx : null}
        highlight={q.prompt.kind === 'position' ? { idx: q.prompt.idx, fret: q.prompt.fret } : null}
      />
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{ko.exercises.quiz.progress(view.index + 1, view.total)}</p>
        <p className="text-xl font-semibold">
          {q.prompt.kind === 'position'
            ? ko.exercises.q1.positionPrompt
            : ko.exercises.q1.symbolPrompt(stringNumber(q.prompt.idx))}
        </p>
        <Choices runner={runner} view={view} />
        <Feedback runner={runner} view={view} />
      </div>
    </div>
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
    <div className="flex flex-col gap-3" data-testid="q3-view">
      <p className="text-sm text-muted">{ko.exercises.quiz.progress(view.index + 1, view.total)}</p>
      <p className="text-3xl font-bold">
        {q.prompt.kind === 'name'
          ? ko.exercises.q3.namePrompt(stringNumber(q.prompt.idx))
          : ko.exercises.q3.pluckPrompt(openName(q.prompt.idx))}
      </p>
      <Choices runner={runner} view={view} />
      <Feedback runner={runner} view={view} />
    </div>
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
    <div className="flex flex-col gap-3" data-testid="q4-view">
      <p className="text-sm text-muted">{ko.exercises.quiz.progress(view.index + 1, view.total)}</p>
      <p className="text-2xl font-semibold">{ko.exercises.q4.prompt}</p>
      <Button large variant="secondary" onClick={() => runner.command('mark')}>
        {ko.exercises.q4.replay}
      </Button>
      <Choices runner={runner} view={view} />
      <Feedback runner={runner} view={view} />
    </div>
  );
}

export function QuizSummary({ result }: { result: QuizResult; params: unknown }) {
  return (
    <div data-testid="quiz-summary">
      <p className="text-xl font-bold">{ko.exercises.quiz.score(result.correct, result.questions)}</p>
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
    <div className="flex flex-col items-center gap-3 text-center" data-testid="q2-view">
      <p className="text-sm text-muted">
        {ko.exercises.quiz.progress(Math.min(view.index + 1, view.total), view.total)}
      </p>
      <p className="font-bold" style={{ fontSize: 'clamp(3rem, 20vh, 9rem)' }}>
        {view.chordClass ?? ''}
      </p>
      <p className="text-2xl tabular-nums">
        {view.countdown > 0 ? ko.exercises.q2.countdown(view.countdown) : ''}
      </p>
      <p>{view.chordClass ? ko.exercises.q2.prompt(view.chordClass) : ''}</p>
      <div aria-live="polite" className="min-h-6">
        {view.heard && <p>{ko.exercises.q2.heard(view.heard)}</p>}
      </div>
      {view.self && (
        <div className="flex gap-2">
          <Button large onClick={() => runner.command('manual1')}>
            1 {ko.exercises.q2.self.manual1}
          </Button>
          <Button large variant="secondary" onClick={() => runner.command('manual2')}>
            2 {ko.exercises.q2.self.manual2}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Q2Summary({ result }: { result: RecallResult; params: unknown }) {
  const passed = result.items.filter(
    (i) => i.correct && i.reactionMs !== null && i.reactionMs <= RECALL_LIMIT_MS,
  ).length;
  return (
    <p className="text-xl font-bold" data-testid="q2-summary">
      {ko.exercises.q2.passed(passed, result.items.length)}
    </p>
  );
}
