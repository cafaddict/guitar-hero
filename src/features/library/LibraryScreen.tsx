import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { audioEngine, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { SEED_VOICINGS } from '../../content/voicings';
import type { SkillState } from '../../domain/records';
import { chordLevel } from '../../domain/skills';
import { stringNumber } from '../../domain/strings';
import { midiName, STANDARD_TUNING } from '../../domain/theory';
import { expectedNotes, partialCollisionMap } from '../../domain/voicing';
import { ko } from '../../i18n/ko';
import { Button, ButtonLink } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import { Icon } from '../../ui/icons';
import { Screen } from '../../ui/Screen';
import { renderChordPreview } from './chordAudio';

/** Chord library (SPEC §12.1): every voicing in one grid, in stage order, each tile saying its stage and level. */
export function LibraryScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const [skills, setSkills] = useState<Map<string, SkillState>>(new Map());
  useEffect(() => {
    void repo.skillMap().then(setSkills);
  }, []);
  const voicings = [...SEED_VOICINGS].sort((a, b) => a.stage - b.stage);
  return (
    <Screen title={ko.library.title} width="wide">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {voicings.map((v) => (
          <li key={v.id}>
            <Link
              to={`/library/${encodeURIComponent(v.id)}`}
              className="card flex h-full flex-col items-center gap-1 rounded-2xl border border-border bg-surface p-3 transition-[border-color] hover:border-accent"
              data-testid={`library-${v.id}`}
            >
              <ChordDiagram voicing={v} leftHanded={settings?.leftHanded ?? false} />
              <span className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted">
                <span>{ko.library.stage(v.stage)}</span>
                <span aria-hidden="true">·</span>
                <span>{ko.library.level[chordLevel(skills.get(`chord:${v.id}`))]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** Chord detail: diagram, expected notes, strum-verifiable strings, listen, start E1 with this chord. */
export function ChordDetailScreen() {
  const { id = '' } = useParams();
  const voicing = SEED_VOICINGS.find((v) => v.id === id);
  const settings = useSettingsStore((s) => s.settings);
  const [playing, setPlaying] = useState(false);
  if (!voicing) return <Screen title={ko.library.title}>{null}</Screen>;
  const notes = expectedNotes(voicing, STANDARD_TUNING);
  const verifiable = partialCollisionMap(voicing, STANDARD_TUNING);
  const listen = () => {
    // Created inside the tap (iOS); synth playback is refused while the microphone is judging.
    void audioEngine.ensureContext().then(() => {
      setPlaying(true);
      try {
        audioEngine.playSynth(renderChordPreview(voicing, audioEngine.sampleRate));
      } finally {
        setTimeout(() => setPlaying(false), 4000);
      }
    });
  };
  return (
    <Screen title={voicing.nameKo ?? voicing.symbol} eyebrow={ko.library.stage(voicing.stage)} width="wide">
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
        <div className="card flex justify-center rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <ChordDiagram voicing={voicing} leftHanded={settings?.leftHanded ?? false} className="max-w-sm" />
        </div>
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-lg font-bold">{ko.library.expected}</h2>
            <ul className="flex flex-wrap gap-2" data-testid="expected-notes">
              {notes.map((n) => (
                <li key={n.idx} className="rounded-xl bg-surface-2 px-3 py-1.5 text-lg tabular-nums">
                  {stringNumber(n.idx)}: {midiName(n.midi)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">{ko.library.verifiable}</h2>
            <ul className="flex flex-wrap gap-2">
              {verifiable.map((s) => (
                <li
                  key={s.idx}
                  className={`rounded-xl px-3 py-1.5 text-lg ${s.verifiable ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'}`}
                >
                  {stringNumber(s.idx)} {s.verifiable ? '✓' : '–'}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-muted">{ko.library.notVerifiable}</p>
          </section>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              to={`/practice/E1?voicingId=${encodeURIComponent(voicing.id)}&mode=pluck`}
              variant="primary"
              large
            >
              <Icon name="play" size={18} />
              {ko.library.practice}
            </ButtonLink>
            <Button large variant="secondary" disabled={playing} onClick={listen}>
              {ko.library.listen}
            </Button>
          </div>
          <ButtonLink to="/library" variant="ghost" className="self-start">
            <Icon name="back" size={18} />
            {ko.library.back}
          </ButtonLink>
        </div>
      </div>
    </Screen>
  );
}
