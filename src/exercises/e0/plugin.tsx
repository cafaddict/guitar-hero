import { useSettingsStore } from '../../app/settingsStore';
import { extractMetrics, type TuningResult, tuningResultSchema } from '../../domain/exerciseResults';
import { STRING_INDICES, stringNumber } from '../../domain/strings';
import { midiName, STANDARD_TUNING } from '../../domain/theory';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { CentsNeedle } from '../../ui/CentsNeedle';
import { TuningDirection } from '../../ui/TuningDirection';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { type E0Params, type E0View, e0ParamsSchema, TuningRunner } from './runner';

const note = (idx: number) => midiName(STANDARD_TUNING.openMidi[idx]!);

function E0ViewComponent({ runner }: { runner: ExerciseRunner<TuningResult, E0View>; params: E0Params }) {
  const { view, phase } = useRunnerSnapshot(runner);
  const idx = Math.min(view.idx, 5);
  const headStyle = useSettingsStore((st) => st.settings?.headStyle ?? '3+3');
  return (
    <div className="flex flex-col gap-4" data-testid="e0-view">
      <ol className="grid grid-cols-6 gap-2">
        {STRING_INDICES.map((i) => (
          <li
            key={i}
            className={`rounded-lg p-2 text-center ${view.inTune[i] ? 'bg-ok/20' : i === view.idx ? 'bg-accent/20' : 'bg-surface'}`}
          >
            <span className="block font-semibold">{stringNumber(i)}</span>
            <span className="text-sm">{view.inTune[i] ? `✓ ${ko.exercises.e0.inTune}` : note(i)}</span>
          </li>
        ))}
      </ol>
      {phase === 'running' && (
        <>
          <p className="text-xl font-semibold">
            {view.manual
              ? ko.exercises.e0.manual(stringNumber(idx), note(idx))
              : ko.exercises.e0.target(stringNumber(idx), note(idx))}
          </p>
          {!view.manual && (
            <>
              <p className="text-center text-4xl font-bold tabular-nums">
                {view.cents === null ? '—' : ko.common.cents(view.cents)}
              </p>
              <CentsNeedle cents={view.cents} passCents={3} label={ko.tuner.title} />
              <TuningDirection cents={view.cents} stringIdx={idx} head={headStyle} />
            </>
          )}
          <Button
            large
            variant={view.manual ? 'primary' : 'secondary'}
            onClick={() => runner.command('next')}
          >
            {view.manual ? ko.exercises.e0.next : ko.exercises.e0.skip}
          </Button>
        </>
      )}
    </div>
  );
}

function E0Summary({ result }: { result: TuningResult; params: E0Params }) {
  const n = result.strings.filter((s) => s.inTune).length;
  return (
    <p className="text-xl font-bold">
      {result.complete ? ko.exercises.e0.complete : ko.exercises.e0.done(n)}
    </p>
  );
}

export const e0Plugin: ExercisePlugin<E0Params, TuningResult, E0View> = {
  type: 'E0',
  version: 1,
  titleKey: 'E0',
  paramsSchema: e0ParamsSchema,
  resultSchema: tuningResultSchema,
  defaultParams: () => ({}),
  createRunner: (ctx) => new TuningRunner(ctx),
  View: E0ViewComponent,
  Summary: E0Summary,
  toMetrics: (result) => extractMetrics('E0', result),
  usesMicrophone: true,
};
