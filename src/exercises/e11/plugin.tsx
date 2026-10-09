import {
  extractMetrics,
  HAMMER_MAX_BPM,
  HAMMER_PAIRS,
  type HammerResult,
  hammerResultSchema,
  ladderNextBpm,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { SequenceStage } from '../sequence/SequenceStage';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { type E11Params, type E11View, e11ParamsSchema, HammerRunner } from './runner';

function E11ViewComponent({ runner }: { runner: ExerciseRunner<HammerResult, E11View>; params: E11Params }) {
  const { view } = useRunnerSnapshot(runner);
  const t = ko.exercises.e11;
  const [a, b] = view.pair.split('-') as [string, string];
  if (view.capped)
    return (
      <p className="text-xl" data-testid="e11-capped">
        {t.capped}
      </p>
    );
  return (
    <SequenceStage
      runner={runner}
      title={t.title(view.pair)}
      tabLabel={t.tabLabel(view.pair)}
      testId="e11-view"
    >
      <p>{t.how(a, b)}</p>
      <p className="text-sm text-muted">{t.daily}</p>
      {view.legato && view.legato.total > 0 && (
        <p data-testid="e11-legato" data-beta="true">
          {t.legato(view.legato.heard, view.legato.total)}
        </p>
      )}
      {view.awaitingRating && (
        <div aria-live="polite" data-testid="e11-rating">
          <p>{t.ratePrompt}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
              <Button key={cmd} large variant="secondary" onClick={() => runner.command(cmd)}>
                {t.rate[k + 1]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </SequenceStage>
  );
}

function E11Summary({ result }: { result: HammerResult; params: E11Params }) {
  const t = ko.exercises.e11;
  return (
    <div data-testid="e11-summary">
      <p className="text-xl font-bold">{t.title(result.pair)}</p>
      {result.legatoBeta && result.legatoBeta.total > 0 && (
        <p>{t.legato(result.legatoBeta.heard, result.legatoBeta.total)}</p>
      )}
      {result.evenRating !== null && <p>{t.rate[result.evenRating]}</p>}
      <p>
        {ko.exercises.sequence.ladder[result.ladder](
          Math.min(HAMMER_MAX_BPM, ladderNextBpm(result.bpm, result.ladder)),
        )}
      </p>
    </div>
  );
}

/** The hardest pair first: never practised, then the lowest latest evenness rating (§11.16). */
export function nextHammerRun(params: E11Params, recent: readonly HammerResult[]): E11Params {
  const latest = new Map<string, HammerResult>();
  for (const r of recent) if (!latest.has(r.pair)) latest.set(r.pair, r);
  const score = (pair: string) => {
    const r = latest.get(pair);
    return r === undefined ? -1 : (r.evenRating ?? 0);
  };
  const pair = [...HAMMER_PAIRS].sort((x, y) => score(x) - score(y))[0]!;
  const last = latest.get(pair);
  const bpm = last ? Math.min(HAMMER_MAX_BPM, ladderNextBpm(last.bpm, last.ladder)) : 60;
  return { ...params, pair, bpm };
}

export const e11Plugin: ExercisePlugin<E11Params, HammerResult, E11View> = {
  type: 'E11',
  version: 1,
  titleKey: 'E11',
  paramsSchema: e11ParamsSchema,
  resultSchema: hammerResultSchema,
  defaultParams: () => e11ParamsSchema.parse({}),
  createRunner: (ctx, params) => new HammerRunner(ctx, params),
  View: E11ViewComponent,
  Summary: E11Summary,
  toMetrics: (result) => extractMetrics('E11', result),
  withHistory: (params, recent) => nextHammerRun(params, recent),
  usesMicrophone: true,
};
