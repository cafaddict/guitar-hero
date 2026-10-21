/**
 * Curriculum "이 단계 연습" (D-072): the stage page lists the stage's exercises — each can be played right away
 * (StagePracticeScreen) or picked, in order, for a session (SessionScreen's custom branch).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { loadStoredState } from '../../app/storedState';
import { exerciseDefinition } from '../../exercises/registry';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Button, ButtonLink } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';
import { Choice } from '../../ui/Field';
import { FocusScreen } from '../../ui/FocusScreen';
import { Icon } from '../../ui/icons';
import { Phrases } from '../../ui/Phrases';
import type { StoredState } from '../home/homeModel';
import { routineNoticeText } from '../home/noticeText';
import { slotLabel } from '../routineEditor/slotLabel';
import { itemTitle } from '../session/itemTitle';
import { pluginParamsFor } from '../session/routineParams';
import { practiceOptions, stageContent, stageItems } from './stagePracticeModel';

/** What SessionScreen receives in the navigation state to run a curriculum session. */
export interface CustomSessionRequest {
  stage: number;
  /** Indexes into practiceOptions(stage), in the order they were picked. */
  options: number[];
}

/** The stage's exercises as the learner sees them: named after what they will be, available or not. */
function useStageOptions(stage: number, state: StoredState) {
  return useMemo(() => {
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
}

/** "여러 개 골라 세션으로": brings the list into view and moves the keyboard focus there with it. */
function showPracticeList() {
  const list = document.getElementById('stage-practice');
  list?.scrollIntoView();
  list?.focus({ preventScroll: true });
}

/**
 * The stage page's first step (SPEC §4.4): the stage's first available exercise, one tap away, above the
 * reading. The full list (one now, or several as a session) stays further down.
 */
export function StageQuickStart({ stage, state }: { stage: number; state: StoredState }) {
  const first = useStageOptions(stage, state).find((o) => o.available);
  const t = ko.curriculum.practice;
  if (!first) return null;
  return (
    <Card
      tone="accent"
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3"
      data-testid="stage-quick-start"
    >
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-accent">{t.quickTitle}</p>
        <p className="text-xl font-bold" id="stage-quick-label">
          <Phrases text={first.label} />
        </p>
      </div>
      <div data-primary-action>
        {/* Two links read "바로 하기" on the page: each names its exercise as its description. */}
        <ButtonLink
          to={`/curriculum/${stage}/practice/${first.index}`}
          variant="primary"
          large
          aria-describedby="stage-quick-label"
          data-testid="stage-practice-now"
        >
          <Icon name="play" size={18} />
          {t.now}
        </ButtonLink>
      </div>
      <Button variant="ghost" onClick={showPracticeList}>
        {t.pickMany}
      </Button>
    </Card>
  );
}

export function StagePracticeList({ stage, state }: { stage: number; state: StoredState }) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<number[]>([]);
  const t = ko.curriculum.practice;
  const options = useStageOptions(stage, state);
  const toggle = (index: number) =>
    setPicked((p) => (p.includes(index) ? p.filter((i) => i !== index) : [...p, index]));
  const request: CustomSessionRequest = { stage, options: picked };
  return (
    <Card
      as="section"
      className="mt-5 scroll-mt-6"
      id="stage-practice"
      tabIndex={-1}
      data-testid="stage-practice"
    >
      <CardHeader title={t.title} className="mb-1" />
      <p className="text-sm text-muted">{t.intro}</p>
      {stage !== state.progression.stage && <p className="mt-1 text-sm text-info">{t.otherStage}</p>}
      <ul className="mt-3 divide-y divide-border">
        {options.map(({ option, index, label, available }) => {
          const order = picked.indexOf(index);
          return (
            <li
              key={option.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              data-testid="stage-practice-item"
            >
              {/* At least a phrase wide: on a phone the controls wrap under the name (F-18). */}
              <span className="min-w-0 flex-1 basis-48 font-medium" id={`stage-option-${index}`}>
                <Phrases text={label} />
              </span>
              {available ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Choice
                    type="checkbox"
                    label={order >= 0 ? t.order(order + 1) : t.add}
                    className="px-2"
                    checked={order >= 0}
                    onChange={() => toggle(index)}
                    data-testid="stage-practice-pick"
                  />
                  <ButtonLink
                    to={`/curriculum/${stage}/practice/${index}`}
                    aria-describedby={`stage-option-${index}`}
                    data-testid="stage-practice-now"
                  >
                    <Icon name="play" size={16} />
                    {t.now}
                  </ButtonLink>
                </span>
              ) : (
                <span className="text-sm text-muted">{t.none}</span>
              )}
            </li>
          );
        })}
      </ul>
      {/* Amber only once something is picked: until then the quick start above is the one next step. */}
      <Button
        className="mt-4"
        large
        variant={picked.length > 0 ? 'primary' : 'secondary'}
        disabled={picked.length === 0}
        onClick={() => navigate('/session', { state: { custom: request } })}
        data-testid="stage-practice-start"
      >
        {t.start(picked.length)}
      </Button>
    </Card>
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
  const [runActive, setRunActive] = useState(false);
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
  const stagePath = `/curriculum/${stageNo}`;
  const back = <ButtonLink to={stagePath}>{t.back}</ButtonLink>;
  if (!plan) return <FocusScreen title={ko.curriculum.title} exit={{ to: stagePath }} busy />;
  const item = plan.items[at];
  const definition = item ? exerciseDefinition(item.exerciseType) : undefined;
  if (!item || !definition) {
    return (
      <FocusScreen title={ko.curriculum.title} exit={{ to: stagePath }}>
        <p data-testid="stage-practice-none">{t.noneHint}</p>
        <div className="mt-4">{back}</div>
      </FocusScreen>
    );
  }
  return (
    <FocusScreen title={itemTitle(item)} exit={{ to: stagePath }} exitDisabled={runActive}>
      {plan.notices.map((n) => (
        <p key={n.code} className="mb-2 text-sm text-info">
          {routineNoticeText(n)}
        </p>
      ))}
      <ExerciseHost
        key={`${item.id}#${run}`}
        definition={definition}
        params={pluginParamsFor(item, definition, plan.content)}
        content={plan.content}
        onActiveChange={setRunActive}
        renderAfter={() => (
          <div className="mt-5 flex flex-wrap gap-3">
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
    </FocusScreen>
  );
}
