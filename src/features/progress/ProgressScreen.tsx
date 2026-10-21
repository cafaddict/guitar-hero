import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { BEGINNER_CHORD_CLASSES, voicingById, voicingForClass } from '../../content/voicings';
import { type Attempt, dayKey } from '../../domain/records';
import { dueReviews } from '../../domain/srs';
import { stringNumber } from '../../domain/strings';
import { ko } from '../../i18n/ko';
import { ButtonLink } from '../../ui/Button';
import { CardHeader, Card as Panel } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Select } from '../../ui/Field';
import { Icon } from '../../ui/icons';
import { Screen } from '../../ui/Screen';
import { Stat } from '../../ui/Stat';
import { type StoredState, streakWeeks, weekPracticeMinutes } from '../home/homeModel';
import { reviewLabel } from '../home/subjectLabel';
import { patternLabel } from '../session/itemTitle';
import {
  chordStringHeatmap,
  pairTrend,
  patternBests,
  practicedPairs,
  type ReviewRow,
  reviewQueue,
  timingTrend,
  weeklyMinutes,
} from './progressModel';

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false };
const grid = { stroke: 'var(--border)', strokeDasharray: '3 4', vertical: false };
/** Recharts draws its tooltip with inline styles: give it the theme's ground and text. */
const tooltip = {
  contentStyle: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--fg)',
  },
  itemStyle: { color: 'var(--fg)' },
  labelStyle: { color: 'var(--muted)' },
  cursor: { stroke: 'var(--border)' },
};

function Card({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <Panel as="section" data-testid={testId}>
      <CardHeader title={title} level={2} />
      {children}
    </Panel>
  );
}

const noData = <EmptyState icon={<Icon name="chart" size={28} />} text={ko.progressScreen.noData} />;

/**
 * Progress dashboard (SPEC §12.1). Every chart has a text equivalent (table/list/sr-only text) for screen
 * readers, so the drawings are hidden from assistive tech and kept out of the tab order.
 */
/** What is due now and what comes next, by name (D-081). */
function ReviewQueueList({ queue }: { queue: { due: ReviewRow[]; upcoming: ReviewRow[] } }) {
  const t = ko.progressScreen;
  if (queue.due.length === 0 && queue.upcoming.length === 0) return null;
  const rows = (list: ReviewRow[], when: (days: number) => string, testId: string) => (
    <ul className="space-y-1 text-sm" data-testid={testId}>
      {list.map((row) => (
        <li key={row.item.subjectKey} className="flex justify-between gap-3">
          <span className="min-w-0">{reviewLabel(row.item)}</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums text-muted">{when(row.days)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mb-4 space-y-2" data-testid="review-queue">
      <p className="text-sm text-muted">{t.reviewHow}</p>
      {queue.due.length > 0 && (
        <>
          <h3 className="text-sm font-semibold">{t.reviewDueTitle}</h3>
          {rows(queue.due, t.reviewOverdue, 'review-due')}
        </>
      )}
      {queue.upcoming.length > 0 && (
        <>
          <h3 className="text-sm font-semibold">{t.reviewUpcomingTitle}</h3>
          {rows(queue.upcoming, t.reviewIn, 'review-upcoming')}
        </>
      )}
    </div>
  );
}

export function ProgressScreen() {
  const [state, setState] = useState<StoredState | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [pair, setPair] = useState<string | null>(null);
  useEffect(() => {
    void loadStoredState(Date.now()).then(setState);
    void repo.attempts().then(setAttempts);
  }, []);
  const pairs = useMemo(() => practicedPairs(attempts), [attempts]);
  const selectedPair = pair ?? pairs[0] ?? null;
  if (!state) return <Screen title={ko.progressScreen.title} busy />;
  const now = Date.now();
  const weeks = weeklyMinutes(state.sessions, now);
  const trend = selectedPair ? pairTrend(attempts, selectedPair) : [];
  const heat = chordStringHeatmap(
    BEGINNER_CHORD_CLASSES.map((c) => voicingById(voicingForClass(c, state.progression.gVoicing))),
    state.skills,
  );
  const bests = patternBests(state.skills);
  const timing = timingTrend(attempts);
  const sessions = [...state.sessions]
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
  const t = ko.progressScreen;

  return (
    <Screen title={t.title} width="wide">
      <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-xl">
        <Stat
          label={ko.home.weekLabel}
          value={ko.home.weekValue(weekPracticeMinutes(state.sessions, now))}
          icon={<Icon name="clock" size={14} />}
        />
        <Stat
          label={ko.home.streakLabel}
          value={ko.home.streakValue(streakWeeks(state.sessions, now))}
          icon={<Icon name="flame" size={14} />}
        />
        <Stat
          label={t.sessionsLabel}
          value={t.sessionsValue(sessions.length)}
          icon={<Icon name="check" size={14} />}
        />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title={t.weekly} testId="progress-weekly">
          {weeks.every((w) => w.minutes === 0) ? (
            <EmptyState
              icon={<Icon name="chart" size={28} />}
              text={t.weeklyEmpty}
              action={<ButtonLink to="/">{t.goPractice}</ButtonLink>}
            />
          ) : (
            <div className="h-48" aria-hidden="true">
              <ResponsiveContainer>
                <BarChart data={weeks} accessibilityLayer={false}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={32} />
                  <Bar
                    dataKey="minutes"
                    fill="var(--accent)"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="sr-only">{weeks.map((w) => `${w.label} ${w.minutes}`).join(', ')}</p>
        </Card>

        <Card title={ko.progressScreen.pairs} testId="progress-pairs">
          {pairs.length === 0 ? (
            noData
          ) : (
            <>
              <Select
                className="mb-3 w-fit"
                value={selectedPair ?? ''}
                onChange={(e) => setPair(e.target.value)}
                aria-label={ko.progressScreen.pairs}
              >
                {pairs.map((p) => (
                  <option key={p} value={p}>
                    {p.replace('|', ' ↔ ')}
                  </option>
                ))}
              </Select>
              <div className="h-48" aria-hidden="true">
                <ResponsiveContainer>
                  <ComposedChart data={trend.map((p, i) => ({ ...p, n: i + 1 }))} accessibilityLayer={false}>
                    <CartesianGrid {...grid} />
                    <XAxis dataKey="n" {...axis} />
                    <YAxis {...axis} width={32} />
                    <Scatter dataKey="value" fill="var(--info)" isAnimationActive={false} />
                    <Line
                      dataKey="median"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="sr-only">{trend.map((p) => p.value.toFixed(0)).join(', ')}</p>
            </>
          )}
        </Card>

        <Card title={ko.progressScreen.heatmap} testId="progress-heatmap">
          <table className="w-full border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr>
                <th scope="col" />
                {[6, 5, 4, 3, 2, 1].map((n) => (
                  <th key={n} scope="col" className="font-semibold text-muted">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.map((row) => (
                <tr key={row.voicingId}>
                  <th scope="row" className="pr-2 text-left font-semibold">
                    {row.voicingId}
                  </th>
                  {row.cells.map((cell) => (
                    // Tints run fail → ok; the number sits in the ground colour, which stays readable on both
                    // ends in every theme (light tints in the dark themes, dark tints in the light theme).
                    <td
                      key={stringNumber(cell.idx)}
                      className={`h-8 rounded-md tabular-nums ${cell.ratio === null ? 'bg-surface-2 text-muted' : 'font-semibold text-bg'}`}
                      style={
                        cell.ratio === null
                          ? undefined
                          : {
                              background: `color-mix(in srgb, var(--ok) ${Math.round(cell.ratio * 100)}%, var(--fail))`,
                            }
                      }
                    >
                      {cell.ratio === null ? '·' : `${Math.round(cell.ratio * 100)}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={ko.progressScreen.patterns} testId="progress-patterns">
          <ul className="divide-y divide-border">
            {bests.map((b) => (
              <li key={b.patternId} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 font-medium">{patternLabel(b.patternId)}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {b.bpm === null ? '—' : `${b.bpm} BPM`}
                  {b.target !== null && <span className="text-muted"> / {b.target}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={ko.progressScreen.timing} testId="progress-timing">
          {timing.length === 0 ? (
            noData
          ) : (
            <div className="h-48" aria-hidden="true">
              <ResponsiveContainer>
                <LineChart data={timing} accessibilityLayer={false}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="day" {...axis} />
                  <YAxis {...axis} width={32} />
                  <Tooltip {...tooltip} />
                  <Legend wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }} />
                  <Line
                    name={ko.progressScreen.mean}
                    dataKey="mean"
                    stroke="var(--accent)"
                    isAnimationActive={false}
                  />
                  <Line
                    name={ko.progressScreen.sd}
                    dataKey="sd"
                    stroke="var(--retry)"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title={ko.progressScreen.sessions} testId="progress-sessions">
          <p className="mb-3">{ko.progressScreen.reviews(dueReviews(state.reviews, now).length)}</p>
          <ReviewQueueList queue={reviewQueue(state.reviews, now)} />
          {sessions.length === 0 ? (
            noData
          ) : (
            <ul className="divide-y divide-border" data-testid="session-list">
              {sessions.slice(0, 30).map((s) => (
                <li key={s.id} className="py-1.5 tabular-nums">
                  {ko.progressScreen.sessionRow(
                    dayKey(s.startedAt),
                    Math.round((s.endedAt! - s.startedAt) / 60_000),
                    s.completedItems,
                    s.plannedItems,
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Screen>
  );
}
