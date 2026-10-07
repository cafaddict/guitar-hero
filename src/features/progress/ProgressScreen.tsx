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
import { Screen } from '../../ui/Screen';
import type { StoredState } from '../home/homeModel';
import {
  chordStringHeatmap,
  pairTrend,
  patternBests,
  practicedPairs,
  timingTrend,
  weeklyMinutes,
} from './progressModel';

const axis = { stroke: 'var(--muted)', fontSize: 12 };

function Card({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-lg bg-surface p-4" data-testid={testId}>
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Progress dashboard (SPEC §12.1). Every chart has a text equivalent (table/list) for screen readers. */
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
  if (!state) return <Screen title={ko.progressScreen.title}>{null}</Screen>;
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

  return (
    <Screen title={ko.progressScreen.title}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={ko.progressScreen.weekly} testId="progress-weekly">
          <div className="h-48" aria-hidden="true">
            <ResponsiveContainer>
              <BarChart data={weeks}>
                <CartesianGrid stroke="var(--surface-2)" />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} />
                <Bar dataKey="minutes" fill="var(--accent)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">{weeks.map((w) => `${w.label} ${w.minutes}`).join(', ')}</p>
        </Card>

        <Card title={ko.progressScreen.pairs} testId="progress-pairs">
          {pairs.length === 0 ? (
            <p className="text-muted">{ko.progressScreen.noData}</p>
          ) : (
            <>
              <select
                className="mb-2 min-h-12 rounded-lg bg-surface-2 px-3 text-fg"
                value={selectedPair ?? ''}
                onChange={(e) => setPair(e.target.value)}
                aria-label={ko.progressScreen.pairs}
              >
                {pairs.map((p) => (
                  <option key={p} value={p}>
                    {p.replace('|', ' ↔ ')}
                  </option>
                ))}
              </select>
              <div className="h-48" aria-hidden="true">
                <ResponsiveContainer>
                  <ComposedChart data={trend.map((p, i) => ({ ...p, n: i + 1 }))}>
                    <CartesianGrid stroke="var(--surface-2)" />
                    <XAxis dataKey="n" {...axis} />
                    <YAxis {...axis} />
                    <Scatter dataKey="value" fill="var(--info)" isAnimationActive={false} />
                    <Line dataKey="median" stroke="var(--accent)" dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="sr-only">{trend.map((p) => p.value.toFixed(0)).join(', ')}</p>
            </>
          )}
        </Card>

        <Card title={ko.progressScreen.heatmap} testId="progress-heatmap">
          <table className="w-full text-center text-sm">
            <thead>
              <tr>
                <th scope="col" />
                {[6, 5, 4, 3, 2, 1].map((n) => (
                  <th key={n} scope="col">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.map((row) => (
                <tr key={row.voicingId}>
                  <th scope="row" className="pr-2 text-left">
                    {row.voicingId}
                  </th>
                  {row.cells.map((cell) => (
                    <td
                      key={stringNumber(cell.idx)}
                      className="p-1"
                      style={{
                        background:
                          cell.ratio === null
                            ? 'transparent'
                            : `color-mix(in srgb, var(--ok) ${Math.round(cell.ratio * 100)}%, var(--fail))`,
                      }}
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
          <ul>
            {bests.map((b) => (
              <li key={b.patternId} className="flex justify-between">
                <span>{b.patternId}</span>
                <span className="tabular-nums">
                  {b.bpm === null ? '—' : `${b.bpm} BPM`}
                  {b.target !== null && <span className="text-muted"> / {b.target}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={ko.progressScreen.timing} testId="progress-timing">
          {timing.length === 0 ? (
            <p className="text-muted">{ko.progressScreen.noData}</p>
          ) : (
            <div className="h-48" aria-hidden="true">
              <ResponsiveContainer>
                <LineChart data={timing}>
                  <CartesianGrid stroke="var(--surface-2)" />
                  <XAxis dataKey="day" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip />
                  <Legend />
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
          <p className="mb-2">{ko.progressScreen.reviews(dueReviews(state.reviews, now).length)}</p>
          {sessions.length === 0 ? (
            <p className="text-muted">{ko.progressScreen.noData}</p>
          ) : (
            <ul className="space-y-1" data-testid="session-list">
              {sessions.slice(0, 30).map((s) => (
                <li key={s.id}>
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
