import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { UpdateToast } from '../../app/pwa';
import { repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { loadStoredState } from '../../app/storedState';
import { stageDef } from '../../content/curriculum';
import type { GVoicing } from '../../content/voicings';
import { FINAL_STAGE, promote } from '../../domain/progression';
import { generateRoutine, type RoutinePlan } from '../../domain/routine';
import { prepareSession } from '../../domain/sessionPrep';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { itemTitle } from '../session/itemTitle';
import type { SplitResume } from '../session/sessionModel';
import { pendingSplit } from '../session/splitResume';
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
import { subjectLabel } from './subjectLabel';

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
                    : n.code === 'userTemplate'
                      ? ko.home.notices.userTemplate
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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          to="/session"
          className={`${linkClass} min-h-16 bg-accent px-6 text-lg text-accent-fg`}
          data-testid="start-session"
        >
          {done ? ko.home.again : ko.home.start}
        </Link>
        <Link to="/routine/edit" className={`${linkClass} bg-surface-2`} data-testid="edit-routine">
          {ko.home.editRoutine}
        </Link>
      </div>
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

  /** The first half of a split session that can be resumed today (§7.3-11). */
  const [split, setSplit] = useState<SplitResume | null>(null);
  const reload = useCallback(() => {
    void (async () => {
      // A half from an earlier day is closed first, so it counts in the stored state.
      setSplit(await pendingSplit(Date.now()));
      setData(await loadStoredState(Date.now()));
    })();
  }, []);

  useEffect(() => {
    if (!redirect) reload();
  }, [redirect, reload]);

  if (redirect) return <Navigate to="/onboarding" replace />;
  if (!data) return <Screen title={ko.app.title}>{null}</Screen>;

  const now = Date.now();
  // What the next session start will do (expired / new prescriptions, G switch) — shown, saved at session start.
  const prep = prepareSession({
    progression: data.progression,
    skills: data.skills,
    recentSamples: data.recentSamples,
    sessionNumber: data.history.sessionNumber,
    now,
  });
  const stored = { ...data, progression: prep.progression };
  const plan = generateRoutine(routineInputFrom(stored, now));
  const checklist = stageChecklist(stored, now);
  const def = stageDef(data.progression.stage);
  const nextStage = data.progression.stage + 1;
  const promoteNow = async (conditional: boolean) => {
    const pairs = conditional && checklist ? checklist.plateauedPairs : [];
    await repo.saveProgression(
      promote(prep.progression, Date.now(), conditional, pairs, data.history.sessionNumber),
    );
    reload();
  };
  const switchG = async (to: GVoicing) => {
    await repo.saveProgression({ ...prep.progression, gVoicing: to });
    reload();
  };

  return (
    <Screen title={ko.app.title}>
      <UpdateToast />
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
      {split && (
        <section className="mb-4 rounded-lg bg-surface p-4" data-testid="split-resume">
          <p>{ko.home.splitResume}</p>
          <Link
            to="/session?resume=1"
            className={`${linkClass} mt-2 min-h-16 bg-accent px-6 text-lg text-accent-fg`}
            data-testid="resume-session"
          >
            {ko.home.resumeSession}
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
          {(prep.gSuggestion !== null || prep.progression.prescriptions.length > 0) && (
            <section className="rounded-lg bg-surface p-4" data-testid="recommendations">
              <h2 className="text-lg font-bold">{ko.home.recommendations}</h2>
              {prep.gSuggestion !== null && (
                <div className="mt-2" data-testid="g-switch">
                  <p>{ko.home.gSwitch(prep.gSuggestion)}</p>
                  <Button
                    className="mt-2"
                    variant="secondary"
                    onClick={() => void switchG(prep.gSuggestion!)}
                  >
                    {ko.home.gSwitchYes}
                  </Button>
                </div>
              )}
              <ul className="mt-2 space-y-1 text-sm">
                {prep.progression.prescriptions.map((p) => (
                  <li key={p.subjectKey} data-testid="prescription">
                    {ko.home.prescription[p.kind](subjectLabel(p.subjectKey))}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-lg bg-surface p-4" data-testid="stage-card">
            <h2 className="text-lg font-bold">{ko.home.stage(data.progression.stage, def.name)}</h2>
            {data.progression.completedBeginner1 && (
              <p className="text-ok" data-testid="beginner1-done">
                {ko.home.completedBeginner}
              </p>
            )}
            {data.progression.completedBeginner2 && (
              <p className="text-ok font-bold" data-testid="beginner2-done">
                {ko.home.completedBeginner2(data.progression.beginner2CompletedAt ?? null)}
              </p>
            )}
            {checklist && !data.progression.completedBeginner2 && (
              <>
                <h3 className="mt-2 text-sm text-muted">{ko.home.checklist}</h3>
                <RuleChecklist rules={checklist.rules} />
                {checklist.allMet && (
                  <div className="mt-3">
                    <p>
                      {data.progression.stage >= FINAL_STAGE
                        ? ko.home.completeBeginner2
                        : ko.home.promote(nextStage)}
                    </p>
                    <Button className="mt-2" onClick={() => void promoteNow(false)} data-testid="promote-now">
                      {data.progression.stage >= FINAL_STAGE
                        ? ko.home.completeBeginner2Yes
                        : ko.home.promoteYes}
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
            {weakPairs(data.skills, data.curriculum, data.progression.stage).length === 0 && (
              <p className="mt-1 text-sm text-muted">{ko.home.noPairs}</p>
            )}
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
