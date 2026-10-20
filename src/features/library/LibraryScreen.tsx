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
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import { Screen } from '../../ui/Screen';
import { renderChordPreview } from './chordAudio';

const linkClass = 'inline-flex min-h-12 items-center rounded-lg px-4 font-semibold';

/** Chord library (SPEC §12.1): voicing grid by stage. */
export function LibraryScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const [skills, setSkills] = useState<Map<string, SkillState>>(new Map());
  useEffect(() => {
    void repo.skillMap().then(setSkills);
  }, []);
  const stages = [...new Set(SEED_VOICINGS.map((v) => v.stage))].sort((a, b) => a - b);
  return (
    <Screen title={ko.library.title} width="wide">
      {stages.map((stage) => (
        <section key={stage} className="mb-6">
          <h2 className="mb-3 font-bold">{ko.library.stage(stage)}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {SEED_VOICINGS.filter((v) => v.stage === stage).map((v) => (
              <li key={v.id}>
                <Link
                  to={`/library/${encodeURIComponent(v.id)}`}
                  className="flex flex-col items-center rounded-xl border border-border bg-surface p-2 transition-[border-color] hover:border-accent"
                  data-testid={`library-${v.id}`}
                >
                  <ChordDiagram voicing={v} leftHanded={settings?.leftHanded ?? false} />
                  <span className="text-sm text-muted">
                    {ko.library.level[chordLevel(skills.get(`chord:${v.id}`))]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
    <Screen title={voicing.nameKo ?? voicing.symbol}>
      <div className="grid gap-4 md:grid-cols-2">
        <ChordDiagram voicing={voicing} leftHanded={settings?.leftHanded ?? false} />
        <div className="flex flex-col gap-3">
          <section>
            <h2 className="font-bold">{ko.library.expected}</h2>
            <ul className="flex flex-wrap gap-3" data-testid="expected-notes">
              {notes.map((n) => (
                <li key={n.idx}>
                  {stringNumber(n.idx)}: {midiName(n.midi)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-bold">{ko.library.verifiable}</h2>
            <ul className="flex flex-wrap gap-3">
              {verifiable.map((s) => (
                <li key={s.idx} className={s.verifiable ? 'text-ok' : 'text-muted'}>
                  {stringNumber(s.idx)} {s.verifiable ? '✓' : '–'}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">{ko.library.notVerifiable}</p>
          </section>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={playing} onClick={listen}>
              {ko.library.listen}
            </Button>
            <Link
              className={`${linkClass} bg-accent text-accent-fg`}
              to={`/practice/E1?voicingId=${encodeURIComponent(voicing.id)}&mode=pluck`}
            >
              {ko.library.practice}
            </Link>
          </div>
          <Link className={`${linkClass} bg-surface-2`} to="/library">
            {ko.library.back}
          </Link>
        </div>
      </div>
    </Screen>
  );
}
