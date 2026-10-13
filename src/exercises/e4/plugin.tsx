import { voicingById } from '../../content/voicings';
import {
  type AnchorDrillResult,
  anchorDrillResultSchema,
  extractMetrics,
} from '../../domain/exerciseResults';
import { pairsAmong, parsePairId } from '../../domain/pairs';
import { stringNumber } from '../../domain/strings';
import { ko } from '../../i18n/ko';
import { ChordDiagram } from '../../ui/ChordDiagram';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { TimedSelfReport } from '../ui/TimedSelfReport';
import { AnchorDrillRunner, type E4Params, type E4View, e4ParamsSchema } from './runner';

function E4ViewComponent({
  runner,
  ctx,
}: {
  runner: ExerciseRunner<AnchorDrillResult, E4View>;
  params: E4Params;
  ctx: ExerciseContext;
}) {
  const { view, phase, remainingMs } = useRunnerSnapshot(runner);
  const finger = ko.exercises.e1.fingerName;
  return (
    <TimedSelfReport
      testId="e4-view"
      phase={phase}
      remainingMs={remainingMs}
      startLabel={ko.exercises.e4.start}
      stopLabel={ko.exercises.e4.stop}
      reviewPrompt={ko.exercises.e4.review}
      value={ko.exercises.e4.success(view.success)}
      confirmLabel={ko.exercises.e4.confirm}
      onCommand={(cmd) => runner.command(cmd)}
    >
      <h2 className="text-xl font-bold" data-testid="e4-kind" data-kind={view.kind}>
        {view.kind === 'anchor' ? ko.exercises.e4.anchorTitle : ko.exercises.e4.airTitle}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <ChordDiagram voicing={view.from} leftHanded={ctx.settings.leftHanded} />
        <ChordDiagram voicing={view.to} leftHanded={ctx.settings.leftHanded} />
      </div>
      <ul className="space-y-1 text-lg">
        {view.analysis.anchors.map((a) => (
          <li key={`a-${a.idx}`} className="font-semibold text-accent">
            {ko.exercises.e4.anchor(finger(a.finger), stringNumber(a.idx), a.fret)}
          </li>
        ))}
        {view.analysis.slides.map((s) => (
          <li key={`s-${s.idx}`}>
            {ko.exercises.e4.slide(finger(s.finger), stringNumber(s.idx), s.fromFret, s.toFret)}
          </li>
        ))}
      </ul>
      <p>{view.kind === 'anchor' ? ko.exercises.e4.anchorHow : ko.exercises.e4.airHow}</p>
      <p className="text-sm text-muted">{ko.exercises.e4.noScore}</p>
    </TimedSelfReport>
  );
}

function E4Summary({ result }: { result: AnchorDrillResult; params: E4Params }) {
  return (
    <p className="text-xl font-bold">
      {result.kind === 'anchor' ? ko.exercises.e4.anchorTitle : ko.exercises.e4.airTitle}
      {result.selfReportSuccess !== null && ` · ${ko.exercises.e4.success(result.selfReportSuccess)}`}
    </p>
  );
}

export const e4Plugin: ExercisePlugin<E4Params, AnchorDrillResult, E4View> = {
  type: 'E4',
  version: 1,
  titleKey: 'E4',
  paramsSchema: e4ParamsSchema,
  resultSchema: anchorDrillResultSchema,
  defaultParams: (content) => {
    const [from, to] = parsePairId(pairsAmong(content.unlockedChordClasses)[0] ?? 'A|D');
    return { from, to, durationMs: 90_000 };
  },
  createRunner: (ctx, params) => new AnchorDrillRunner(ctx, params, voicingById),
  View: E4ViewComponent,
  Summary: E4Summary,
  howTo: () => {
    const g = ko.exercises.guide.E4;
    return { steps: [g.anchor, g.air, g.report], terms: ['fingerNumbers'] };
  },
  toMetrics: (result) => extractMetrics('E4', result),
  usesMicrophone: false,
};
