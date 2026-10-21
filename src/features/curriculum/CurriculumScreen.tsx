import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { loadStoredState } from '../../app/storedState';
import { CURRICULUM } from '../../content/curriculum';
import type { StageDef } from '../../content/schemas';
import { BEGINNER1_LAST_STAGE } from '../../domain/progression';
import { ko } from '../../i18n/ko';
import { Badge } from '../../ui/Badge';
import { ButtonLink } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';
import { Icon } from '../../ui/icons';
import { ProgressRing, percent } from '../../ui/ProgressRing';
import { Screen } from '../../ui/Screen';
import { type StoredState, stageChecklist } from '../home/homeModel';
import { RuleChecklist } from '../home/RuleChecklist';
import { practiceRefLabel } from './practiceRefLabel';
import { StagePracticeList } from './StagePractice';

type StageStatus = 'passed' | 'current' | 'upcoming';

const NODE: Record<StageStatus, string> = {
  passed: 'bg-ok text-bg',
  current: 'bg-accent text-accent-fg ring-4 ring-accent/25',
  upcoming: 'border-2 border-border bg-bg text-muted',
};

const groupOf = (stage: number): 1 | 2 => (stage <= BEGINNER1_LAST_STAGE ? 1 : 2);

/** One stop on the roadmap: a node on the rail (✓ / the stage number) and the stage card beside it. */
function StageStop({
  def,
  status,
  last,
  progress,
}: {
  def: StageDef;
  status: StageStatus;
  last: boolean;
  /** The current stage's criteria fill (0..1), shown as a small ring. */
  progress: number | null;
}) {
  const node = (
    <div className="flex w-10 shrink-0 flex-col items-center">
      <span
        aria-hidden="true"
        className={`grid size-10 place-items-center rounded-full font-bold tabular-nums ${NODE[status]}`}
      >
        {status === 'passed' ? <Icon name="check" size={20} /> : def.stage}
      </span>
      {!last && <span className={`w-0.5 flex-1 ${status === 'passed' ? 'bg-ok/60' : 'bg-border'}`} />}
    </div>
  );
  const body = (
    <>
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {ko.home.stage(def.stage, def.name)}
        {status === 'current' && <Badge tone="accent">{ko.curriculum.current}</Badge>}
        {status === 'passed' && <Badge tone="ok">✓ {ko.curriculum.passed}</Badge>}
      </p>
      <p className="mt-1 text-sm text-muted">{def.summary}</p>
      {progress !== null && (
        <div className="mt-3 flex items-center gap-3">
          <ProgressRing
            value={progress}
            label={ko.home.stageProgress(percent(progress))}
            size={40}
            stroke={5}
          />
          <span aria-hidden="true" className="text-sm font-medium">
            {ko.home.stageProgress(percent(progress))}
          </span>
        </div>
      )}
    </>
  );
  const cardClass = `card mb-3 block min-w-0 flex-1 rounded-2xl border p-4 ${
    status === 'current' ? 'border-accent/60 bg-accent-soft' : 'border-border bg-surface'
  }`;
  return (
    <li className="flex gap-4">
      {node}
      {def.locked ? (
        <div aria-disabled="true" className={`${cardClass} text-muted`}>
          {body}
          <p className="text-sm">🔒 {ko.curriculum.locked}</p>
        </div>
      ) : (
        <Link
          to={`/curriculum/${def.stage}`}
          className={`${cardClass} transition-[border-color] hover:border-accent`}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

/** Curriculum (SPEC §12.1, D-087): stages 0–11 as a roadmap in two groups, the graduation exam between them. */
export function CurriculumScreen() {
  const [state, setState] = useState<StoredState | null>(null);
  useEffect(() => {
    void loadStoredState(Date.now()).then(setState);
  }, []);
  const progression = state?.progression ?? null;
  const evaluation = state ? stageChecklist(state, Date.now()) : null;
  const statusOf = (stage: number): StageStatus =>
    progression === null || stage > progression.stage
      ? 'upcoming'
      : stage === progression.stage
        ? 'current'
        : 'passed';
  const group = (level: 1 | 2) => {
    const defs = CURRICULUM.filter((def) => groupOf(def.stage) === level);
    return (
      <section aria-labelledby={`stage-group-${level}`}>
        <h2 id={`stage-group-${level}`} className="mb-4 flex items-baseline gap-2">
          <span className="text-lg font-bold">{ko.curriculum.group(level)}</span>
          <span className="text-sm text-muted">
            {ko.curriculum.groupRange(defs[0]!.stage, defs[defs.length - 1]!.stage)}
          </span>
        </h2>
        <ol>
          {defs.map((def, i) => (
            <StageStop
              key={def.stage}
              def={def}
              status={statusOf(def.stage)}
              last={i === defs.length - 1}
              progress={
                statusOf(def.stage) === 'current' && evaluation && !progression?.completedBeginner2
                  ? evaluation.progress
                  : null
              }
            />
          ))}
        </ol>
      </section>
    );
  };
  return (
    <Screen title={ko.curriculum.title} width="wide" busy={state === null}>
      {(progression?.completedBeginner1 || progression?.completedBeginner2) && (
        <Card tone="ok" className="mb-6 space-y-1">
          {progression.completedBeginner1 && <p className="text-ok">{ko.home.completedBeginner}</p>}
          {progression.completedBeginner2 && (
            <p className="font-bold text-ok" data-testid="curriculum-beginner2">
              {ko.home.completedBeginner2(progression.beginner2CompletedAt ?? null)}
            </p>
          )}
        </Card>
      )}
      <div className="max-w-3xl space-y-4" data-testid="stage-list">
        {group(1)}
        {/* The graduation exam closes Beginner 1 (§7.7). */}
        <div className="flex gap-4 pb-4">
          <div className="flex w-10 shrink-0 justify-center">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-surface-2 text-accent"
            >
              <Icon name="flag" size={20} />
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <ButtonLink to="/exam" variant="secondary">
              {ko.curriculum.exam}
            </ButtonLink>
            <p className="min-w-0 flex-1 text-sm text-muted">{ko.curriculum.examMilestone}</p>
          </div>
        </div>
        {group(2)}
      </div>
    </Screen>
  );
}

/** Stage detail: what to learn, tips, new chords and the promotion criteria with their current state. */
export function StageScreen() {
  const { stage = '0' } = useParams();
  const def = CURRICULUM.find((d) => d.stage === Number(stage));
  const [state, setState] = useState<StoredState | null>(null);
  useEffect(() => {
    void loadStoredState(Date.now()).then(setState);
  }, []);
  if (!def) return <Screen title={ko.curriculum.title}>{null}</Screen>;
  // Another stage's minimum stay counts that stage's own sessions, not the current stage's.
  const sessionsInStage = (s: StoredState) =>
    def.stage === s.progression.stage
      ? s.progression.sessionsInStage
      : s.sessions.filter((x) => x.endedAt !== null && x.completedItems > 0 && x.stage === def.stage).length;
  const evaluation = state
    ? stageChecklist(
        {
          ...state,
          progression: { ...state.progression, stage: def.stage, sessionsInStage: sessionsInStage(state) },
        },
        Date.now(),
      )
    : null;
  const level = groupOf(def.stage);
  return (
    <Screen
      title={ko.home.stage(def.stage, def.name)}
      eyebrow={`${ko.curriculum.title} · ${ko.curriculum.group(level)}`}
      width="wide"
      busy={state === null}
    >
      <p className="-mt-3 mb-6 max-w-3xl text-muted">{def.summary}</p>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <Card as="section">
            <CardHeader title={ko.curriculum.learn} />
            {def.newChords.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-muted">{ko.curriculum.newChords}</span>
                {def.newChords.map((chord) => (
                  <Badge key={chord} tone="accent" className="text-sm">
                    {chord}
                  </Badge>
                ))}
              </div>
            )}
            <ul className="space-y-3">
              {def.learn.map((l) => (
                <li key={l.text} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0">
                    {l.text}
                    <span className="mt-0.5 block text-sm text-muted">
                      {ko.curriculum.practicedBy(l.practicedBy.map(practiceRefLabel).join(', '))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card as="section">
            <CardHeader title={ko.curriculum.tips} />
            <ul className="space-y-2">
              {def.tips.map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card as="section">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{ko.curriculum.criteria}</h2>
            {evaluation && (
              <ProgressRing
                value={evaluation.progress}
                label={ko.home.stageProgress(percent(evaluation.progress))}
              >
                {percent(evaluation.progress)}
              </ProgressRing>
            )}
          </div>
          {evaluation && <RuleChecklist rules={evaluation.rules} />}
          {def.stage === BEGINNER1_LAST_STAGE && (
            <ButtonLink className="mt-5" to="/exam">
              {ko.curriculum.exam}
            </ButtonLink>
          )}
        </Card>
      </div>
      {state && <StagePracticeList stage={def.stage} state={state} />}
    </Screen>
  );
}
