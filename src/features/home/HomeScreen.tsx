import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { loadStoredState } from '../../app/storedState';
import { stageDef } from '../../content/curriculum';
import { promote } from '../../domain/progression';
import { generateRoutine, type RoutinePlan } from '../../domain/routine';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { itemTitle } from '../session/itemTitle';
import {
  backupReminderDue,
  practicedToday,
  routineInputFrom,
  type StoredState,
  stageChecklist,
  streakWeeks,
  weakPairs,
  weekPracticeMinutes,
} from './homeModel';
import { RuleChecklist } from './RuleChecklist';

/** The first-run redirect happens once per page load; "나중에 하기" then leaves the user on home. */
let firstRunRedirectDone = false;

const linkClass = 'inline-flex min-h-12 items-center rounded-lg px-4 font-semibold';

function RoutineCard({
  plan,
  state,
  onLonger,
}: {
  plan: RoutinePlan;
  state: StoredState;
  onLonger: () => void;
}) {
  const now = Date.now();
  if (plan.kind === 'rest') {
    return (
      <section className="rounded-lg bg-surface p-4" data-testid="routine-card" data-kind="rest">
        <h2 className="text-xl font-bold">{ko.home.todayRoutine}</h2>
        <p className="mt-2 text-retry">{ko.safety.restDay}</p>
      </section>
    );
  }
  const minutes = Math.round(plan.totalSec / 60);
  const done = practicedToday(state.sessions, now);
  return (
    <section className="rounded-lg bg-surface p-4" data-testid="routine-card" data-kind="practice">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">{ko.home.todayRoutine}</h2>
        <span className="text-muted">{ko.home.totalTime(minutes)}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {plan.notices.map((n) => (
          <li key={n.code} className="text-info">
            {n.code === 'gapReview'
              ? ko.home.notices.gapReview(n.days)
              : n.code === 'capApplied'
                ? ko.home.notices.capApplied(n.minutes)
                : n.code === 'painReduced'
                  ? ko.safety.painReduced
                  : n.code === 'changesCapReached'
                    ? ko.home.notices.changesCapReached
                    : ''}
          </li>
        ))}
      </ul>
      <ol className="mt-2 divide-y divide-surface-2" data-testid="routine-items">
        {plan.items.map((item) => (
          <li key={item.id} className="flex justify-between py-1">
            <span>
              <span className="text-muted">{ko.home.blocks[item.block]} · </span>
              {itemTitle(item)}
            </span>
            <span className="tabular-nums text-muted">
              {ko.home.itemMinutes(Math.max(1, Math.round(item.durationSec / 60)))}
            </span>
          </li>
        ))}
      </ol>
      {plan.needsCapConfirmation && (
        <div className="mt-3 rounded-lg bg-surface-2 p-3">
          <p>
            {ko.safety.capConfirm(state.settings.sessionMinutes > 20 ? 20 : state.settings.sessionMinutes)}
          </p>
          <Button className="mt-2" variant="secondary" onClick={onLonger}>
            {ko.home.longer}
          </Button>
        </div>
      )}
      {done && (
        <p className="mt-3 text-ok" data-testid="done-today">
          {ko.home.doneToday}
        </p>
      )}
      <Link
        to="/session"
        className={`${linkClass} mt-4 min-h-16 bg-accent px-6 text-lg text-accent-fg`}
        data-testid="start-session"
      >
        {done ? ko.home.again : ko.home.start}
      </Link>
    </section>
  );
}

/** Home "오늘" (SPEC §12.1): today's routine, stage checklist, weak pairs, week time, streak, backup reminder. */
export function HomeScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const [data, setData] = useState<(StoredState & { lastBackupAt: number | null }) | null>(null);
  const needsOnboarding = settings !== null && !settings.micOnboardingDone && !settings.micDisabled;
  const redirect = needsOnboarding && !firstRunRedirectDone;
  if (redirect) firstRunRedirectDone = true;

  const reload = useCallback(() => {
    void loadStoredState(Date.now()).then(setData);
  }, []);

  useEffect(() => {
    if (!redirect) reload();
  }, [redirect, reload]);

  if (redirect) return <Navigate to="/onboarding" replace />;
  if (!data) return <Screen title={ko.app.title}>{null}</Screen>;

  const now = Date.now();
  const plan = generateRoutine(routineInputFrom(data, now));
  const checklist = stageChecklist(data, now);
  const def = stageDef(Math.min(data.progression.stage, 7));
  const nextStage = data.progression.stage + 1;
  const promoteNow = async (conditional: boolean) => {
    const drills = conditional && checklist ? checklist.plateauedPairs : [];
    await repo.saveProgression(promote(data.progression, Date.now(), conditional, drills));
    reload();
  };

  return (
    <Screen title={ko.app.title}>
      {needsOnboarding && (
        <section className="mb-4 rounded-lg bg-surface p-4">
          <p>{ko.home.firstRun}</p>
          <Link className={`${linkClass} mt-3 bg-accent text-accent-fg`} to="/onboarding">
            {ko.home.startOnboarding}
          </Link>
        </section>
      )}
      {backupReminderDue(data.lastBackupAt, data.sessions, now) && (
        <section role="status" className="mb-4 rounded-lg bg-surface-2 p-4" data-testid="backup-reminder">
          <p>{ko.home.backupReminder}</p>
          <Link className={`${linkClass} mt-2 bg-surface`} to="/settings">
            {ko.home.backupNow}
          </Link>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <RoutineCard
          plan={plan}
          state={data}
          onLonger={() => {
            void updateSettings({ confirmedOverCap: true }).then(reload);
          }}
        />
        <div className="flex flex-col gap-4">
          <section className="rounded-lg bg-surface p-4" data-testid="stage-card">
            <h2 className="text-lg font-bold">{ko.home.stage(data.progression.stage, def.name)}</h2>
            {data.progression.completedBeginner1 && <p className="text-ok">{ko.home.completedBeginner}</p>}
            {checklist && !data.progression.completedBeginner1 && (
              <>
                <h3 className="mt-2 text-sm text-muted">{ko.home.checklist}</h3>
                <RuleChecklist rules={checklist.rules} />
                {checklist.allMet && (
                  <div className="mt-3">
                    <p>{ko.home.promote(nextStage)}</p>
                    <Button className="mt-2" onClick={() => void promoteNow(false)}>
                      {ko.home.promoteYes}
                    </Button>
                  </div>
                )}
                {!checklist.allMet && checklist.conditionalAvailable && (
                  <div className="mt-3">
                    <p>{ko.home.promoteConditional}</p>
                    <Button className="mt-2" variant="secondary" onClick={() => void promoteNow(true)}>
                      {ko.home.promoteYes}
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="rounded-lg bg-surface p-4">
            <h2 className="text-lg font-bold">{ko.home.weakPairs}</h2>
            <ul className="mt-1">
              {weakPairs(data.skills, data.curriculum, data.progression.stage).map((p) => (
                <li key={p.pairId} className="flex justify-between">
                  <span>{p.pairId.replace('|', ' ↔ ')}</span>
                  <span className="text-muted">
                    {p.median === null ? ko.home.notPracticed : ko.home.perMinute(p.median)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-wrap gap-4 rounded-lg bg-surface p-4" data-testid="week-card">
            <span data-testid="week-minutes">{ko.home.week(weekPracticeMinutes(data.sessions, now))}</span>
            <span>{ko.home.streak(streakWeeks(data.sessions, now))}</span>
            <span>{ko.home.reviewsDue(plan.items.filter((i) => i.block === 'review').length)}</span>
          </section>
        </div>
      </div>
    </Screen>
  );
}
