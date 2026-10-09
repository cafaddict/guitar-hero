import {
  extractMetrics,
  type FretPositionResult,
  fretPositionResultSchema,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import {
  type E16Params,
  type E16View,
  e16ParamsSchema,
  type FretPosition,
  FretPositionRunner,
} from './runner';

/** Where the fingertip goes for each position: x along a one-fret space (decorative, the text says it). */
const DOT_X: Record<FretPosition, number> = { behind: 108, middle: 70, onFret: 122 };

function PositionPicture({ pos }: { pos: FretPosition }) {
  return (
    <svg viewBox="0 0 160 60" className="h-16 w-40 text-fg" aria-hidden="true">
      <line x1="10" y1="30" x2="150" y2="30" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="8" x2="20" y2="52" stroke="currentColor" strokeWidth="5" />
      <line x1="122" y1="8" x2="122" y2="52" stroke="currentColor" strokeWidth="5" />
      <circle cx={DOT_X[pos]} cy="30" r="9" className="fill-accent" />
    </svg>
  );
}

function statusText(status: string): string {
  return ko.exercises.e16.status[status as keyof typeof ko.exercises.e16.status] ?? status;
}

function Comparison({ positions }: { positions: E16View['positions'] }) {
  return (
    <table className="w-full text-left" data-testid="e16-table">
      <thead>
        <tr>
          <th scope="col">{ko.exercises.e16.position}</th>
          <th scope="col">{ko.exercises.e16.result}</th>
          <th scope="col">{ko.exercises.e16.clarity}</th>
          <th scope="col">{ko.exercises.e16.buzzBeta}</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.pos}>
            <th scope="row">{ko.exercises.e16.positions[p.pos]}</th>
            <td>{p.statuses.map(statusText).join(' · ') || '—'}</td>
            <td className="tabular-nums">{p.clarity === null ? '—' : p.clarity.toFixed(2)}</td>
            <td className="tabular-nums" data-beta="true">
              {p.buzzSuspect === undefined ? '—' : p.buzzSuspect}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function E16ViewComponent({
  runner,
}: {
  runner: ExerciseRunner<FretPositionResult, E16View>;
  params: E16Params;
}) {
  const { view } = useRunnerSnapshot(runner);
  return (
    <section
      className="flex flex-col gap-3"
      data-testid="e16-view"
      data-position={view.position ?? ''}
      data-step={view.positions.reduce((n, p) => n + p.statuses.length, 0)}
    >
      <p>{ko.exercises.e16.intro}</p>
      {view.position && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-4">
          <PositionPicture pos={view.position} />
          <p className="text-2xl font-bold">
            {ko.exercises.e16.instruction(
              ko.exercises.e16.positions[view.position],
              view.pluck,
              view.perPosition,
            )}
          </p>
        </div>
      )}
      {view.retry && <p className="text-retry">{ko.exercises.e16.retry}</p>}
      {view.source === 'self' && view.position && (
        <div className="flex flex-wrap gap-2">
          <Button large variant="secondary" onClick={() => runner.command('manual1')}>
            {ko.exercises.e16.self.clean}
          </Button>
          <Button large variant="secondary" onClick={() => runner.command('manual2')}>
            {ko.exercises.e16.self.muted}
          </Button>
          <Button large variant="secondary" onClick={() => runner.command('manual3')}>
            {ko.exercises.e16.self.buzz}
          </Button>
        </div>
      )}
      <Comparison positions={view.positions} />
    </section>
  );
}

function E16Summary({ result }: { result: FretPositionResult; params: E16Params }) {
  return (
    <div className="flex flex-col gap-2">
      <Comparison positions={result.positions.map((p) => ({ ...p, statuses: p.statuses }))} />
      <p className="text-muted">{ko.exercises.e16.takeaway}</p>
    </div>
  );
}

export const e16Plugin: ExercisePlugin<E16Params, FretPositionResult, E16View> = {
  type: 'E16',
  version: 1,
  titleKey: 'E16',
  paramsSchema: e16ParamsSchema,
  resultSchema: fretPositionResultSchema,
  defaultParams: () => ({ plucksPerPosition: 2 }),
  createRunner: (ctx, params) => new FretPositionRunner(ctx, params),
  View: E16ViewComponent,
  Summary: E16Summary,
  toMetrics: (result) => extractMetrics('E16', result),
  usesMicrophone: true,
};
