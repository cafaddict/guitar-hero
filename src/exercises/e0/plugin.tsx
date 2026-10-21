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
import { PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import { type E0Params, type E0View, e0ParamsSchema, TuningRunner } from './runner';

const note = (idx: number) => midiName(STANDARD_TUNING.openMidi[idx]!);

function E0ViewComponent({ runner }: { runner: ExerciseRunner<TuningResult, E0View>; params: E0Params }) {
  const { view, phase } = useRunnerSnapshot(runner);
  const idx = Math.min(view.idx, 5);
  const headStyle = useSettingsStore((st) => st.settings?.headStyle ?? '3+3');
  const running = phase === 'running';
  return (
    <PracticeStage
      data-testid="e0-view"
      figure={
        <div className="flex w-full flex-col gap-4">
          <ol className="grid grid-cols-6 gap-2">
            {STRING_INDICES.map((i) => (
              <li
                key={i}
                className={`rounded-xl border-2 p-2 text-center ${view.inTune[i] ? 'border-transparent bg-ok-soft' : i === view.idx ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface'}`}
              >
                <span className="block text-lg font-semibold">{stringNumber(i)}</span>
                <span className={`text-sm ${view.inTune[i] ? 'text-ok' : ''}`}>
                  {view.inTune[i] ? `✓ ${ko.exercises.e0.inTune}` : note(i)}
                </span>
              </li>
            ))}
          </ol>
          {running && !view.manual && (
            <>
              <CentsNeedle cents={view.cents} passCents={3} label={ko.tuner.title} />
              <TuningDirection cents={view.cents} stringIdx={idx} head={headStyle} />
            </>
          )}
        </div>
      }
      primary={
        running ? (
          <Button
            large
            variant={view.manual ? 'primary' : 'secondary'}
            onClick={() => runner.command('next')}
          >
            {view.manual ? ko.exercises.e0.next : ko.exercises.e0.skip}
          </Button>
        ) : undefined
      }
    >
      {running && (
        <>
          <p className="text-2xl font-semibold">
            {view.manual
              ? ko.exercises.e0.manual(stringNumber(idx), note(idx))
              : ko.exercises.e0.target(stringNumber(idx), note(idx))}
          </p>
          {!view.manual && (
            <p className="text-5xl font-bold tabular-nums">
              {view.cents === null ? '—' : ko.common.cents(view.cents)}
            </p>
          )}
        </>
      )}
    </PracticeStage>
  );
}

function E0Summary({ result }: { result: TuningResult; params: E0Params }) {
  const n = result.strings.filter((s) => s.inTune).length;
  return (
    <p className={RESULT_HEADLINE}>{result.complete ? ko.exercises.e0.complete : ko.exercises.e0.done(n)}</p>
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
  howTo: () => ({ steps: ko.exercises.guide.E0, terms: ['stringNumbers', 'noteNames'] }),
  toMetrics: (result) => extractMetrics('E0', result),
  usesMicrophone: true,
};
