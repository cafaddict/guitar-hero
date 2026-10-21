import {
  extractMetrics,
  type FretPositionResult,
  fretPositionResultSchema,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { PracticeStage } from '../ui/PracticeStage';
import {
  type E16Params,
  type E16View,
  e16ParamsSchema,
  type FretPosition,
  FretPositionRunner,
} from './runner';

/** Where the fingertip goes for each position: x along a one-fret space (decorative, the text says it). */
const DOT_X: Record<FretPosition, number> = { behind: 108, middle: 70, onFret: 122 };

/**
 * One fret space as the player sees the neck: the headstock side (lower fret) on the left for a right-handed
 * player, mirrored for a left-handed one (like the chord diagrams, §12.1).
 */
export function PositionPicture({
  pos,
  leftHanded = false,
  className = 'h-16 w-40',
}: {
  pos: FretPosition;
  leftHanded?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 60"
      className={`text-fg ${className}`}
      aria-hidden="true"
      data-mirrored={leftHanded}
    >
      <g transform={leftHanded ? 'translate(160 0) scale(-1 1)' : undefined}>
        <line x1="10" y1="30" x2="150" y2="30" stroke="currentColor" strokeWidth="2" />
        <line x1="20" y1="8" x2="20" y2="52" stroke="currentColor" strokeWidth="5" />
        <line x1="122" y1="8" x2="122" y2="52" stroke="currentColor" strokeWidth="5" />
        <circle cx={DOT_X[pos]} cy="30" r="9" className="fill-accent" />
      </g>
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
        <tr className="border-b border-border text-sm text-muted">
          <th scope="col" className="py-2 pr-3 font-semibold">
            {ko.exercises.e16.position}
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            {ko.exercises.e16.result}
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            {ko.exercises.e16.clarity}
          </th>
          <th scope="col" className="py-2 font-semibold">
            {ko.exercises.e16.buzzBeta}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {positions.map((p) => (
          <tr key={p.pos}>
            <th scope="row" className="py-2 pr-3 font-semibold">
              {ko.exercises.e16.positions[p.pos]}
            </th>
            <td className="py-2 pr-3">{p.statuses.map(statusText).join(' · ') || '—'}</td>
            <td className="py-2 pr-3 tabular-nums">{p.clarity === null ? '—' : p.clarity.toFixed(2)}</td>
            <td className="py-2 tabular-nums" data-beta="true">
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
  ctx,
}: {
  runner: ExerciseRunner<FretPositionResult, E16View>;
  params: E16Params;
  ctx: ExerciseContext;
}) {
  const { view } = useRunnerSnapshot(runner);
  return (
    <PracticeStage
      data-testid="e16-view"
      data-position={view.position ?? ''}
      data-step={view.positions.reduce((n, p) => n + p.statuses.length, 0)}
      figure={
        view.position && (
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-surface p-5">
            <PositionPicture
              pos={view.position}
              leftHanded={ctx.settings.leftHanded}
              className="h-auto w-full max-w-sm"
            />
            <p className="text-center text-2xl font-bold">
              {ko.exercises.e16.instruction(
                ko.exercises.e16.positions[view.position],
                view.pluck,
                view.perPosition,
              )}
            </p>
          </div>
        )
      }
      primary={
        view.source === 'self' && view.position ? (
          <>
            <Button large variant="secondary" onClick={() => runner.command('manual1')}>
              {ko.exercises.e16.self.clean}
            </Button>
            <Button large variant="secondary" onClick={() => runner.command('manual2')}>
              {ko.exercises.e16.self.muted}
            </Button>
            <Button large variant="secondary" onClick={() => runner.command('manual3')}>
              {ko.exercises.e16.self.buzz}
            </Button>
          </>
        ) : undefined
      }
    >
      <p className="text-lg">{ko.exercises.e16.intro}</p>
      {view.retry && <p className="text-lg text-retry">{ko.exercises.e16.retry}</p>}
      <Comparison positions={view.positions} />
    </PracticeStage>
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
  howTo: () => {
    const g = ko.exercises.guide.E16;
    return { steps: [g.place, g.compare, g.noScore], terms: ['stringNumbers', 'fingerNumbers', 'mutedBuzz'] };
  },
  toMetrics: (result) => extractMetrics('E16', result),
  usesMicrophone: true,
};
