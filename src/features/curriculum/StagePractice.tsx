/**
 * Curriculum "이 단계 연습" (D-072): the stage page lists the stage's exercises — each can be played right away
 * (StagePracticeScreen) or picked, in order, for a session (SessionScreen's custom branch).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { loadStoredState } from '../../app/storedState';
import { exerciseDefinition } from '../../exercises/registry';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import type { StoredState } from '../home/homeModel';
import { routineNoticeText } from '../home/noticeText';
import { slotLabel } from '../routineEditor/slotLabel';
import { itemTitle } from '../session/itemTitle';
import { pluginParamsFor } from '../session/routineParams';
import { practiceOptions, stageContent, stageItems } from './stagePracticeModel';

const linkClass = 'inline-flex min-h-12 items-center rounded-lg bg-surface-2 px-4 font-semibold';

/** What SessionScreen receives in the navigation state to run a curriculum session. */
export interface CustomSessionRequest {
  stage: number;
  /** Indexes into practiceOptions(stage), in the order they were picked. */
  options: number[];
}

export function StagePracticeList({ stage, state }: { stage: number; state: StoredState }) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<number[]>([]);
  const t = ko.curriculum.practice;
  const options = useMemo(() => {
    const now = Date.now();
    const seen = new Set<string>();
    return practiceOptions(stage).flatMap((option, index) => {
      const items = stageItems(state, stage, [option], now).items;
      // Named after what it will actually be (chord, pair, pattern, song); the same exercise listed twice
      // (a template slot and its rotation entry) is shown once.
      const label = items[0] ? itemTitle(items[0]) : slotLabel(option);
      const id = items[0] ? `${items[0].key ?? items[0].exerciseType}|${label}` : `none|${option.id}`;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ option, index, label, available: items.length > 0 }];
    });
  }, [stage, state]);
  const toggle = (index: number) =>
    setPicked((p) => (p.includes(index) ? p.filter((i) => i !== index) : [...p, index]));
  const request: CustomSessionRequest = { stage, options: picked };
  return (
    <section className="mt-6" data-testid="stage-practice">
      <h2 className="text-lg font-bold">{t.title}</h2>
      <p className="text-sm text-muted">{t.intro}</p>
      {stage !== state.progression.stage && <p className="mt-1 text-sm text-info">{t.otherStage}</p>}
      <ul className="mt-2 divide-y divide-surface-2">
        {options.map(({ option, index, label, available }) => {
          const order = picked.indexOf(index);
          return (
            <li
              key={option.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              data-testid="stage-practice-item"
            >
              <span className="min-w-0 flex-1">{label}</span>
              {available ? (
                <span className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-12 items-center gap-2 px-2">
                    <input
                      type="checkbox"
                      className="h-6 w-6"
                      checked={order >= 0}
                      onChange={() => toggle(index)}
                      data-testid="stage-practice-pick"
                    />
                    {order >= 0 ? t.order(order + 1) : t.add}
                  </label>
                  <Link
                    className={linkClass}
                    to={`/curriculum/${stage}/practice/${index}`}
                    data-testid="stage-practice-now"
                  >
                    ▶ {t.now}
                  </Link>
                </span>
              ) : (
                <span className="text-sm text-muted">{t.none}</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-3"
        large
        disabled={picked.length === 0}
        onClick={() => navigate('/session', { state: { custom: request } })}
        data-testid="stage-practice-start"
      >
        {t.start(picked.length)}
      </Button>
    </section>
  );
}

/** One exercise of a stage, right now (/curriculum/:stage/practice/:option), recorded like any standalone run. */
export function StagePracticeScreen() {
  const { stage = '0', option = '0' } = useParams();
  const stageNo = Number(stage);
  const index = Number(option);
  const [state, setState] = useState<StoredState | null>(null);
  const [at, setAt] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    void loadStoredState(Date.now()).then(setState);
  }, []);
  const plan = useMemo(() => {
    if (!state) return null;
    const chosen = practiceOptions(stageNo)[index];
    const { items, notices } = chosen
      ? stageItems(state, stageNo, [chosen], Date.now())
      : { items: [], notices: [] };
    return { items, notices, content: stageContent(state, stageNo) };
  }, [state, stageNo, index]);
  const t = ko.curriculum.practice;
  const back = (
    <Link className={linkClass} to={`/curriculum/${stageNo}`}>
      {t.back}
    </Link>
  );
  if (!plan) return <Screen title={ko.curriculum.title}>{null}</Screen>;
  const item = plan.items[at];
  const definition = item ? exerciseDefinition(item.exerciseType) : undefined;
  if (!item || !definition) {
    return (
      <Screen title={ko.curriculum.title}>
        <p data-testid="stage-practice-none">{t.noneHint}</p>
        <div className="mt-4">{back}</div>
      </Screen>
    );
  }
  return (
    <Screen title={itemTitle(item)}>
      {plan.notices.map((n) => (
        <p key={n.code} className="text-sm text-info">
          {routineNoticeText(n)}
        </p>
      ))}
      <ExerciseHost
        key={`${item.id}#${run}`}
        definition={definition}
        params={pluginParamsFor(item, definition, plan.content)}
        content={plan.content}
        renderAfter={() => (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setRun((n) => n + 1)}>{ko.exercises.common.again}</Button>
            {at + 1 < plan.items.length && (
              <Button
                onClick={() => {
                  setAt((i) => i + 1);
                  setRun((n) => n + 1);
                }}
              >
                {t.next}
              </Button>
            )}
            {back}
          </div>
        )}
      />
    </Screen>
  );
}
