import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { UpdateToast } from '../../app/pwa';
import { repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { loadStoredState } from '../../app/storedState';
import { stageDef } from '../../content/curriculum';
import type { RoutineBlock } from '../../content/schemas';
import type { GVoicing } from '../../content/voicings';
import { FINAL_STAGE, promote } from '../../domain/progression';
import { type Attempt, startOfDay } from '../../domain/records';
import { generateRoutine, type RoutinePlan } from '../../domain/routine';
import { prepareSession } from '../../domain/sessionPrep';
import { dueReviews } from '../../domain/srs';
import { ko } from '../../i18n/ko';
import { Badge } from '../../ui/Badge';
import { Button, ButtonLink } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';
import { Icon } from '../../ui/icons';
import { Phrases } from '../../ui/Phrases';
import { ProgressRing, percent } from '../../ui/ProgressRing';
import { Screen } from '../../ui/Screen';
import { Stat } from '../../ui/Stat';
import { itemTitle } from '../session/itemTitle';
import type { SplitResume } from '../session/sessionModel';
import { pendingSplit } from '../session/splitResume';
import {
  backupReminderDue,
  type DoneToday,
  practicedToday,
  reviewsServedBy,
  routineInputFrom,
  type StoredState,
  stageChecklist,
  streakWeeks,
  todayPractice,
  weakPairs,
  weekPracticeMinutes,
} from './homeModel';
import { routineNoticeText } from './noticeText';
import { RuleChecklist } from './RuleChecklist';
import { subjectLabel } from './subjectLabel';

/** The first-run redirect happens once per page load; "나중에 하기" then leaves the user on home. */
let firstRunRedirectDone = false;

/**
 * Timeline dot per block family (decorative: the block name is written next to it). Warm-up and set-up
 * blocks stay quiet; chord work takes the accent; rhythm and technique, and songs, get their own hue.
 */
const BLOCK_DOT: Record<RoutineBlock, string> = {
  tuning: 'bg-muted',
  warmup: 'bg-muted',
  selfCheck: 'bg-muted',
  knowledge: 'bg-muted',
  rest: 'bg-muted',
  chord: 'bg-accent',
  changes: 'bg-accent',
  recall: 'bg-accent',
  drill: 'bg-accent',
  stageReview: 'bg-accent',
  review: 'bg-accent',
  rhythm: 'bg-info',
  technique: 'bg-info',
  scale: 'bg-info',
  song: 'bg-ok',
  repertoire: 'bg-ok',
};

function RoutineCard({
  plan,
  state,
  doneItems,
  practiced,
  dueKeys,
  onLonger,
  primary,
}: {
  plan: RoutinePlan;
  state: StoredState;
  /** Subjects of the reviews due now: items serving any of them carry a "복습" badge. */
  dueKeys: ReadonlySet<string>;
  /** What was practised today (attempts in or out of a session), listed whenever there is any (D-095). */
  doneItems: readonly DoneToday[];
  /** A session today holds practice, so the routine below is the next session's (rotation moved, D-095). */
  practiced: boolean;
  onLonger: () => void;
  /** Starting the routine is the screen's next step (not while a split half waits to be resumed). */
  primary: boolean;
}) {
  if (plan.kind === 'rest') {
    return (
      <Card as="section" data-testid="routine-card" data-kind="rest">
        <CardHeader title={ko.home.todayRoutine} />
        <p className="text-retry">{ko.safety.restDay}</p>
      </Card>
    );
  }
  const minutes = Math.round(plan.totalSec / 60);
  const done = practiced;
  // primary is false exactly while a split half waits: its first half is today's practice so far.
  const splitPending = !primary;
  return (
    <Card as="section" data-testid="routine-card" data-kind="practice">
      <CardHeader
        title={ko.home.todayRoutine}
        aside={
          done ? undefined : (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" size={16} />
              {ko.home.totalTime(minutes)}
            </span>
          )
        }
      />
      {doneItems.length > 0 && (
        // Runs outside a session (single practice, stage picks) list too; the routine below is then still today's.
        <div className={done ? undefined : 'mb-4 border-b border-border pb-4'}>
          <h3 className="font-semibold">{ko.home.doneItems}</h3>
          <ul className="mt-2 space-y-1.5" data-testid="done-items">
            {doneItems.map((line) => (
              <li key={line.key} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-ok text-bg"
                >
                  <Icon name="check" size={14} />
                </span>
                <span className="min-w-0 flex-1">{line.title}</span>
                {line.count > 1 && (
                  <span className="shrink-0 tabular-nums text-muted">{ko.home.doneCount(line.count)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {done && (
        <>
          <p className="mt-4 font-semibold text-ok" data-testid="done-today">
            {splitPending ? ko.home.splitHalfDone : ko.home.doneToday}
          </p>
          <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-border pt-4">
            <h3 className="font-semibold">{ko.home.nextRoutine}</h3>
            <span className="shrink-0 whitespace-nowrap text-muted">{ko.home.totalTime(minutes)}</span>
          </div>
          <p className="text-sm text-muted" data-testid="rotation-note">
            {ko.home.rotationNote}
          </p>
        </>
      )}
      {plan.notices.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {plan.notices.map((n) => (
            <li key={n.code} className="text-info">
              {routineNoticeText(n)}
            </li>
          ))}
        </ul>
      )}
      {plan.needsCapConfirmation && (
        <Card tone="notice" className="mt-3">
          <p>
            {ko.safety.capConfirm(state.settings.sessionMinutes > 20 ? 20 : state.settings.sessionMinutes)}
          </p>
          <Button className="mt-2" variant="secondary" onClick={onLonger}>
            {ko.home.longer}
          </Button>
        </Card>
      )}
      {/* Above the list: on a phone the list fills the first screen, and the start must not hide behind the tab bar. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex grow sm:grow-0" data-primary-action={primary ? '' : undefined}>
          <ButtonLink
            to="/session"
            variant={primary ? 'primary' : 'secondary'}
            large
            className="grow"
            data-testid="start-session"
          >
            <Icon name="play" size={18} />
            {done ? ko.home.again : ko.home.start}
          </ButtonLink>
        </div>
        <ButtonLink to="/routine/edit" data-testid="edit-routine">
          {ko.home.editRoutine}
        </ButtonLink>
      </div>
      <ol
        className="relative mt-4 before:absolute before:bottom-4 before:left-[0.3125rem] before:top-4 before:w-px before:bg-border"
        data-testid="routine-items"
      >
        {plan.items.map((item) => {
          const reviews = reviewsServedBy(item, dueKeys).length;
          return (
            <li key={item.id} className="relative flex items-start gap-3 py-2">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface ${BLOCK_DOT[item.block]}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-muted">{ko.home.blocks[item.block]}</span>
                <span className="font-medium">
                  <Phrases text={itemTitle(item)} />
                </span>
                {reviews > 0 && (
                  <Badge tone="info" className="ml-2 align-middle" data-testid="review-badge">
                    {ko.home.reviewBadge(reviews)}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap pt-4 text-sm tabular-nums text-muted">
                {ko.home.itemMinutes(Math.max(1, Math.round(item.durationSec / 60)))}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
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
  const [today, setToday] = useState<Attempt[]>([]);
  const reload = useCallback(() => {
    void (async () => {
      // A half from an earlier day is closed first, so it counts in the stored state.
      setSplit(await pendingSplit(Date.now()));
      // Today's attempts land with the state, so the list and "마쳤어요" never show one without the other.
      const attempts = await repo.attemptsSince(startOfDay(Date.now()));
      const state = await loadStoredState(Date.now());
      setToday(attempts);
      setData(state);
    })();
  }, []);

  useEffect(() => {
    if (!redirect) reload();
  }, [redirect, reload]);

  if (redirect) return <Navigate to="/onboarding" replace />;
  if (!data) return <Screen title={ko.home.title} busy />;

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
  const dueKeys = new Set(dueReviews(data.reviews, now).map((r) => r.subjectKey));
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

  const weak = weakPairs(data.skills, data.curriculum, data.progression.stage);
  const reviewsServed = plan.items.reduce((n, item) => n + reviewsServedBy(item, dueKeys).length, 0);

  return (
    <Screen title={ko.home.title} eyebrow={ko.home.date(now)} width="wide">
      <UpdateToast />
      <div className="mb-5 space-y-3 empty:hidden">
        {split && (
          <Card
            tone="accent"
            className="flex flex-wrap items-center justify-between gap-4"
            data-testid="split-resume"
          >
            <p className="min-w-0 flex-1 font-medium">{ko.home.splitResume}</p>
            <div data-primary-action>
              <ButtonLink to="/session?resume=1" variant="primary" large data-testid="resume-session">
                <Icon name="play" size={18} />
                {ko.home.resumeSession}
              </ButtonLink>
            </div>
          </Card>
        )}
        {needsOnboarding && (
          <Card tone="notice" className="flex flex-wrap items-center justify-between gap-4">
            <p className="min-w-0 flex-1">{ko.home.firstRun}</p>
            {/* Secondary: the routine's start stays the one amber action on the screen (F-29). */}
            <ButtonLink to="/onboarding" variant="secondary">
              {ko.home.startOnboarding}
            </ButtonLink>
          </Card>
        )}
        {backupReminderDue(data.lastBackupAt, data.sessions, now) && (
          <Card
            as="section"
            tone="retry"
            role="status"
            className="flex flex-wrap items-center justify-between gap-4"
            data-testid="backup-reminder"
          >
            <p className="min-w-0 flex-1">{ko.home.backupReminder}</p>
            <ButtonLink to="/settings">{ko.home.backupNow}</ButtonLink>
          </Card>
        )}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RoutineCard
          plan={plan}
          state={data}
          doneItems={todayPractice(today, now)}
          practiced={practicedToday(data.sessions, today, now)}
          dueKeys={dueKeys}
          onLonger={() => {
            void updateSettings({ confirmedOverCap: true }).then(reload);
          }}
          primary={split === null}
        />
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2" data-testid="week-card">
            <Stat
              label={ko.home.weekLabel}
              value={ko.home.weekValue(weekPracticeMinutes(data.sessions, now))}
              icon={<Icon name="clock" size={14} />}
              testId="week-minutes"
            />
            <Stat
              label={ko.home.streakLabel}
              value={ko.home.streakValue(streakWeeks(data.sessions, now))}
              icon={<Icon name="flame" size={14} />}
            />
            <Stat
              label={ko.home.reviewsLabel}
              value={ko.home.reviewsValue(reviewsServed)}
              sub={dueKeys.size > reviewsServed ? ko.home.reviewsWaiting(dueKeys.size) : undefined}
              icon={<Icon name="repeat" size={14} />}
              testId="reviews-today"
            />
          </div>
          {(prep.gSuggestion !== null || prep.progression.prescriptions.length > 0) && (
            <Card as="section" tone="accent" data-testid="recommendations">
              <CardHeader title={ko.home.recommendations} />
              {prep.gSuggestion !== null && (
                <div data-testid="g-switch">
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
              <ul className="mt-2 space-y-2 text-sm">
                {prep.progression.prescriptions.map((p) => (
                  <li key={p.subjectKey} data-testid="prescription">
                    {ko.home.prescription[p.kind](subjectLabel(p.subjectKey))}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card as="section" data-testid="stage-card">
            <div className="flex items-center gap-4">
              {checklist && !data.progression.completedBeginner2 && (
                <ProgressRing
                  value={checklist.progress}
                  label={ko.home.stageProgress(percent(checklist.progress))}
                  size={76}
                >
                  {percent(checklist.progress)}
                </ProgressRing>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent">{ko.home.currentStage}</p>
                <h2 className="text-lg font-bold">{ko.home.stage(data.progression.stage, def.name)}</h2>
                <p className="mt-0.5 text-sm text-muted">{def.summary}</p>
              </div>
            </div>
            {data.progression.completedBeginner1 && (
              <p className="mt-3 text-ok" data-testid="beginner1-done">
                {ko.home.completedBeginner}
              </p>
            )}
            {data.progression.completedBeginner2 && (
              <p className="mt-3 font-bold text-ok" data-testid="beginner2-done">
                {ko.home.completedBeginner2(data.progression.beginner2CompletedAt ?? null)}
              </p>
            )}
            {checklist && !data.progression.completedBeginner2 && (
              <>
                <h3 className="mb-3 mt-5 text-sm font-semibold text-muted">{ko.home.checklist}</h3>
                <RuleChecklist rules={checklist.rules} />
                {checklist.allMet && (
                  <Card tone="accent" className="mt-4">
                    <p>
                      {data.progression.stage >= FINAL_STAGE
                        ? ko.home.completeBeginner2
                        : ko.home.promote(nextStage)}
                    </p>
                    <Button className="mt-3" onClick={() => void promoteNow(false)} data-testid="promote-now">
                      {data.progression.stage >= FINAL_STAGE
                        ? ko.home.completeBeginner2Yes
                        : ko.home.promoteYes}
                    </Button>
                  </Card>
                )}
                {!checklist.allMet && checklist.conditionalAvailable && (
                  <Card tone="notice" className="mt-4">
                    <p>{ko.home.promoteConditional}</p>
                    <Button className="mt-3" variant="secondary" onClick={() => void promoteNow(true)}>
                      {ko.home.promoteYes}
                    </Button>
                  </Card>
                )}
              </>
            )}
          </Card>
          <Card as="section">
            <CardHeader title={ko.home.weakPairs} className="mb-1" />
            <p className="text-xs text-muted">{ko.home.weakPairsNote}</p>
            {weak.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{ko.home.noPairs}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {weak.map((p) => (
                  <li key={p.pairId} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 font-medium">{p.pairId.replace('|', ' ↔ ')}</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-muted">
                      {p.median === null ? ko.home.notPracticed : ko.home.perMinute(p.median)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Screen>
  );
}
