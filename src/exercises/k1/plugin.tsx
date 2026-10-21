import { isSelfCheckId, selfChecksOfStage } from '../../content/selfChecks';
import { extractMetrics, type SelfCheckResult, selfCheckResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { SelfCheckPicture } from '../../ui/SelfCheckPicture';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { PracticeStage } from '../ui/PracticeStage';
import { type K1Params, type K1View, k1ParamsSchema, SelfCheckRunner } from './runner';

function cardText(id: string): { title: string; body: string } {
  return isSelfCheckId(id) ? ko.selfChecks[id] : { title: id, body: '' };
}

function K1ViewComponent({ runner }: { runner: ExerciseRunner<SelfCheckResult, K1View>; params: K1Params }) {
  const { view } = useRunnerSnapshot(runner);
  if (view.itemId === null) return null;
  const card = cardText(view.itemId);
  return (
    <PracticeStage
      data-testid="k1-view"
      data-item={view.itemId}
      figure={
        <div className="flex w-full justify-center rounded-2xl bg-surface p-6">
          <SelfCheckPicture id={view.itemId} className="h-auto w-full max-w-sm" />
        </div>
      }
      primary={
        <>
          <Button large onClick={() => runner.command('manual1')} data-testid="k1-done">
            {ko.exercises.k1.done}
          </Button>
          <Button
            large
            variant="secondary"
            onClick={() => runner.command('manual2')}
            data-testid="k1-not-yet"
          >
            {ko.exercises.k1.notYet}
          </Button>
        </>
      }
      secondary={
        (runner.canStepBack?.() ?? false) && (
          <Button variant="secondary" onClick={() => runner.command('prev')} data-testid="k1-previous">
            {ko.exercises.k1.previous}
          </Button>
        )
      }
      notes={<p className="text-muted">{ko.exercises.k1.keys}</p>}
    >
      <p className="text-lg text-muted tabular-nums">
        {ko.exercises.k1.progress(view.index + 1, view.total)}
      </p>
      <h2 className="text-3xl font-bold">{card.title}</h2>
      <p className="text-xl">{card.body}</p>
    </PracticeStage>
  );
}

function K1Summary({ result }: { result: SelfCheckResult; params: K1Params }) {
  return (
    <ul className="space-y-1 text-lg">
      {result.items.map((item) => (
        <li key={item.id}>
          {cardText(item.id).title} · {item.status === 'done' ? ko.exercises.k1.done : ko.exercises.k1.notYet}
        </li>
      ))}
    </ul>
  );
}

export const k1Plugin: ExercisePlugin<K1Params, SelfCheckResult, K1View> = {
  type: 'K1',
  version: 1,
  titleKey: 'K1',
  paramsSchema: k1ParamsSchema,
  resultSchema: selfCheckResultSchema,
  defaultParams: (content) => {
    const items = selfChecksOfStage(content.stage);
    return { items: items.length > 0 ? items : ['posture', 'pick', 'countAloud'] };
  },
  createRunner: (ctx, params) => new SelfCheckRunner(ctx, params),
  View: K1ViewComponent,
  Summary: K1Summary,
  howTo: () => ({ steps: ko.exercises.guide.K1, terms: [] }),
  toMetrics: (result) => extractMetrics('K1', result),
  usesMicrophone: false,
};
