import { PRACTICE_SONGS, songById } from '../../content/songs';
import { extractMetrics, type SongResult, songResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { renderChordProgression } from './listen';
import { type SongParams, SongRunner, type SongView, songParamsSchema } from './runner';

function SongViewComponent({
  runner,
}: {
  runner: ExerciseRunner<SongResult, SongView>;
  params: SongParams;
  ctx: ExerciseContext;
}) {
  const { view, phase } = useRunnerSnapshot(runner);
  const song = view.song;
  const playing = phase === 'running' || phase === 'countIn';
  return (
    <div className="flex flex-col gap-4" data-testid="song-view" data-phase={phase}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">{song.title}</h2>
        <p className="text-xl tabular-nums">{view.bpm} BPM</p>
      </div>
      <p className="text-sm text-muted">
        {ko.exercises.song.modes[view.mode]}
        {view.loopSection !== null &&
          ` · ${ko.exercises.song.loop(song.sections[view.loopSection]?.name ?? '')}`}
      </p>
      {view.chartHidden ? (
        <p className="rounded-lg bg-surface p-6 text-center text-xl">
          {ko.exercises.song.hidden}
          {view.bar !== null && (
            <span className="mt-2 block text-3xl font-bold">
              {ko.exercises.song.bar(view.bar + 1, view.chart.length)}
            </span>
          )}
        </p>
      ) : (
        <ol className="grid grid-cols-4 gap-2" aria-label={song.title}>
          {view.chart.map((b) => (
            <li
              key={b.position}
              className={`rounded-lg p-3 text-center text-2xl font-bold ${view.bar === b.position ? 'bg-accent text-accent-fg' : 'bg-surface'}`}
              aria-current={view.bar === b.position ? 'step' : undefined}
            >
              {b.chord}
            </li>
          ))}
        </ol>
      )}
      {phase === 'countIn' && <p>{ko.exercises.e5.countIn}</p>}
      {(phase === 'armed' || phase === 'ready') && (
        <p>{phase === 'armed' ? ko.exercises.e5.armed : ko.exercises.e5.ready}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {(phase === 'ready' || phase === 'armed') && (
          <>
            <Button large onClick={() => runner.command('toggle')}>
              {ko.exercises.song.start}
            </Button>
            <Button large variant="secondary" onClick={() => runner.command('mark')}>
              {ko.exercises.song.listen}
            </Button>
          </>
        )}
        {playing && (
          <Button large variant="secondary" onClick={() => runner.command('toggle')}>
            {ko.exercises.song.stop}
          </Button>
        )}
      </div>
      {phase === 'review' && (
        <div aria-live="polite" className="flex flex-col gap-2">
          {view.mode === 'learn' && (
            <Button large variant="secondary" onClick={() => runner.command('toggle')}>
              {ko.exercises.song.again}
            </Button>
          )}
          <p>{ko.exercises.song.reviewPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              large
              variant={view.report.completed ? 'primary' : 'secondary'}
              aria-pressed={view.report.completed}
              onClick={() => runner.command('manual1')}
            >
              {ko.exercises.song.completed}
            </Button>
            <Button
              large
              variant={view.report.memorized ? 'primary' : 'secondary'}
              aria-pressed={view.report.memorized}
              onClick={() => runner.command('manual2')}
            >
              {ko.exercises.song.memorized}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => runner.command('dec')} aria-label="−">
              −
            </Button>
            <span>{ko.exercises.song.stops(view.report.stops)}</span>
            <Button variant="secondary" onClick={() => runner.command('inc')} aria-label="+">
              +
            </Button>
          </div>
          <Button large onClick={() => runner.command('next')}>
            {ko.exercises.song.confirm}
          </Button>
        </div>
      )}
    </div>
  );
}

function SongSummary({ result }: { result: SongResult; params: SongParams }) {
  return (
    <div data-testid="song-summary">
      <p className="text-xl font-bold">
        {songById(result.songId).title} · {ko.exercises.song.summary(result.completed, result.stops)}
        {result.memorized && ` · ${ko.exercises.song.memorizedTag}`}
      </p>
      {result.beat1HitRate !== null && <p>{ko.exercises.song.beat1(result.beat1HitRate)}</p>}
    </div>
  );
}

export const songPlugin: ExercisePlugin<SongParams, SongResult, SongView> = {
  type: 'S',
  version: 1,
  titleKey: 'S',
  paramsSchema: songParamsSchema,
  resultSchema: songResultSchema,
  defaultParams: (content) => {
    const song =
      [...PRACTICE_SONGS].reverse().find((s) => s.stage <= Math.max(1, content.stage)) ?? PRACTICE_SONGS[0]!;
    return { songId: song.id, mode: 'learn', bpm: song.bpmDefault, chartHidden: false, loopSection: null };
  },
  createRunner: (ctx, params) =>
    new SongRunner(ctx, params, (chords, bpm, beatsPerBar) =>
      renderChordProgression(chords, bpm, ctx.output.sampleRate(), ctx.content.gVoicing, beatsPerBar),
    ),
  View: SongViewComponent,
  Summary: SongSummary,
  toMetrics: (result) => extractMetrics('S', result),
  usesMicrophone: true,
};
