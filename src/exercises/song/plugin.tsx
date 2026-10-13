import { patternById } from '../../content/patterns';
import { PRACTICE_SONGS, songById } from '../../content/songs';
import { voicingById, voicingForClass } from '../../content/voicings';
import { extractMetrics, type SongResult, songResultSchema } from '../../domain/exerciseResults';
import { renderBacking } from '../../dsp/synth/backing';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { renderChordProgression } from './listen';
import { isBluetoothLabel, type SongParams, SongRunner, type SongView, songParamsSchema } from './runner';

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
    <div
      className="flex flex-col gap-4"
      data-testid="song-view"
      data-phase={phase}
      data-stage={view.stage}
      data-bpm={view.bpm}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">{song.title}</h2>
        <p className="text-xl tabular-nums">{view.bpm} BPM</p>
      </div>
      <p className="text-sm text-muted">
        {ko.exercises.song.stages[view.stage]}
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
      <p className="text-sm text-muted">{ko.exercises.song.optionKeys}</p>
      {view.mode === 'perform' && (phase === 'ready' || phase === 'armed') && (
        <div className="flex flex-col gap-2" data-testid="song-backing">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={view.backingOn ? 'primary' : 'secondary'}
              aria-pressed={view.backingOn}
              onClick={() => runner.command('backing')}
              data-testid="song-backing-toggle"
            >
              {view.backingOn ? ko.exercises.song.backingOn : ko.exercises.song.backingOff}
            </Button>
            {view.backingOn && (
              <Button
                variant="secondary"
                aria-pressed={view.earphones}
                onClick={() => runner.command('ear')}
                data-testid="song-earphones"
                data-earphones={view.earphones}
              >
                {view.earphones ? ko.exercises.song.earphones : ko.exercises.song.speakers}
              </Button>
            )}
          </div>
          {view.backingOn && isBluetoothLabel(view.outputLabel) && (
            <p className="text-retry">{ko.exercises.song.bluetooth}</p>
          )}
          {view.backingOn && <p className="text-sm text-muted">{ko.exercises.song.iosNote}</p>}
        </div>
      )}
      {view.backingAudible && <p className="text-sm text-muted">{ko.exercises.song.speakerNote}</p>}
      {phase === 'review' && view.chordCorrectRatio !== null && (
        <p data-testid="song-chord" data-reference={view.backingAudible}>
          {view.backingAudible
            ? ko.exercises.song.chordCheckReference(view.chordCorrectRatio)
            : ko.exercises.song.chordCheck(view.chordCorrectRatio)}
        </p>
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
      {typeof result.chordCorrectRatio === 'number' && (
        <p>
          {result.backingAudible
            ? ko.exercises.song.chordCheckReference(result.chordCorrectRatio)
            : ko.exercises.song.chordCheck(result.chordCorrectRatio)}
        </p>
      )}
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
    return songParamsSchema.parse({
      songId: song.id,
      mode: 'learn',
      bpm: song.bpmDefault,
      chartHidden: false,
      loopSection: null,
    });
  },
  createRunner: (ctx, params) =>
    new SongRunner(
      ctx,
      params,
      (chords, bpm, beatsPerBar) =>
        renderChordProgression(chords, bpm, ctx.output.sampleRate(), ctx.content.gVoicing, beatsPerBar),
      (chords, patternId, bpm) =>
        renderBacking({
          chords: chords.map((c) => voicingById(voicingForClass(c, ctx.content.gVoicing))),
          pattern: patternById(patternId),
          bpm,
          bars: chords.length,
          sampleRate: ctx.output.sampleRate(),
          model: 'karplus-strong',
          seed: 7,
        }),
    ),
  // The earphone choice is remembered per output device: the latest backing run on that output (§8.6-1).
  // Learn runs carry no choice, so the window reaches far enough back for them not to erase it.
  historyDepth: 50,
  withHistory: (params, recent) => {
    const byOutput: Record<string, boolean> = { ...params.earphonesByOutput };
    for (const r of [...recent].reverse())
      if (r.backingOn && r.outputLabel) byOutput[r.outputLabel] = r.backingAudible !== true;
    return { ...params, earphonesByOutput: byOutput };
  },
  View: SongViewComponent,
  Summary: SongSummary,
  howTo: (params) => {
    const g = ko.exercises.guide.S;
    const song = songById(params.songId);
    const pattern = patternById(song.patternId);
    return {
      steps: [
        g.grid(pattern.timeSignature === '6/8' ? 2 : 4),
        g.pattern(pattern.label),
        g.mode[params.mode],
        g.listen,
        g.goal,
      ],
      terms: ['strumLetters'],
    };
  },
  toMetrics: (result) => extractMetrics('S', result),
  usesMicrophone: true,
};
