import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { CURRICULUM } from '../../content/curriculum';
import type { ProgressionState } from '../../domain/records';
import { ko } from '../../i18n/ko';
import { Screen } from '../../ui/Screen';
import { type StoredState, stageChecklist } from '../home/homeModel';
import { RuleChecklist } from '../home/RuleChecklist';
import { practiceRefLabel } from './practiceRefLabel';

const linkClass = 'inline-flex min-h-12 items-center rounded-lg bg-surface-2 px-4 font-semibold';

/** Curriculum (SPEC §12.1): stages 0–11, 8–11 shown as a locked preview. */
export function CurriculumScreen() {
  const [progression, setProgression] = useState<ProgressionState | null>(null);
  useEffect(() => {
    void repo.progression(Date.now()).then(setProgression);
  }, []);
  return (
    <Screen title={ko.curriculum.title}>
      <ol className="space-y-2" data-testid="stage-list">
        {CURRICULUM.map((def) => {
          const current = progression?.stage === def.stage;
          const passed = progression !== null && def.stage < progression.stage;
          return (
            <li
              key={def.stage}
              className={`rounded-lg p-3 ${current ? 'border-2 border-accent bg-surface' : 'bg-surface'}`}
            >
              {def.locked ? (
                <div aria-disabled="true" className="text-muted">
                  <p className="font-semibold">{ko.home.stage(def.stage, def.name)}</p>
                  <p className="text-sm">{def.summary}</p>
                  <p className="text-sm">🔒 {ko.curriculum.locked}</p>
                </div>
              ) : (
                <Link to={`/curriculum/${def.stage}`} className="block">
                  <p className="font-semibold">
                    {ko.home.stage(def.stage, def.name)}
                    {current && <span className="ml-2 text-accent">({ko.curriculum.current})</span>}
                    {passed && <span className="ml-2 text-ok">✓ {ko.curriculum.passed}</span>}
                  </p>
                  <p className="text-sm text-muted">{def.summary}</p>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <Link className={`${linkClass} mt-4`} to="/exam">
        {ko.curriculum.exam}
      </Link>
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
  return (
    <Screen title={ko.home.stage(def.stage, def.name)}>
      <p className="text-muted">{def.summary}</p>
      {def.newChords.length > 0 && (
        <p className="mt-2 font-semibold">{ko.curriculum.chords(def.newChords.join(', '))}</p>
      )}
      <h2 className="mt-4 text-lg font-bold">{ko.curriculum.learn}</h2>
      <ul className="list-disc pl-6">
        {def.learn.map((l) => (
          <li key={l.text}>
            {l.text}
            <span className="block text-sm text-muted">
              {ko.curriculum.practicedBy(l.practicedBy.map(practiceRefLabel).join(', '))}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="mt-4 text-lg font-bold">{ko.curriculum.tips}</h2>
      <ul className="list-disc pl-6">
        {def.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h2 className="mt-4 text-lg font-bold">{ko.curriculum.criteria}</h2>
      {evaluation && <RuleChecklist rules={evaluation.rules} />}
      {def.stage === 7 && (
        <Link className={`${linkClass} mt-4`} to="/exam">
          {ko.curriculum.exam}
        </Link>
      )}
    </Screen>
  );
}
