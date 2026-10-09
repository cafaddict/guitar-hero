import { Chord, Note } from 'tonal';
import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING } from '../domain/theory';
import { expectedNotes, fingerPlacements } from '../domain/voicing';
import { voicingSchema } from './schemas';
import { SEED_VOICINGS } from './voicings';

const chroma = (name: string) => Note.chroma(name);

describe('AC-D1 seed voicings', () => {
  it('has exactly the 29 SPEC v1.1 §6.4 voicings', () => {
    expect(SEED_VOICINGS.map((v) => v.id)).toEqual([
      'D',
      'A',
      'E',
      'Em',
      'Am',
      'Dm',
      'C',
      'G-2f',
      'G-3f',
      'G-4f',
      'Cadd9',
      'Dsus4',
      'A7sus4',
      'Em7',
      'Fmaj7',
      'F-small',
      'F',
      'G5',
      'C5',
      'E5',
      'A5',
      'D5',
      'F5',
      'A7',
      'D7',
      'E7',
      'G7',
      'C7',
      'B7',
    ]);
  });

  it.each(SEED_VOICINGS.map((v) => [v.id, v] as const))('%s passes the zod schema', (_id, voicing) => {
    expect(() => voicingSchema.parse(voicing)).not.toThrow();
  });

  it.each(SEED_VOICINGS.map((v) => [v.id, v] as const))(
    '%s sounds a subset of its chord tones incl. root (and third unless power/sus)',
    (_id, voicing) => {
      const chord = Chord.get(voicing.symbol);
      expect(chord.empty, `tonal parses ${voicing.symbol}`).toBe(false);
      const chordTones = new Set(chord.notes.map(chroma));
      const sounding = new Set(expectedNotes(voicing, STANDARD_TUNING).map((n) => n.midi % 12));
      for (const pc of sounding)
        expect(chordTones.has(pc), `${voicing.id} pc ${pc} in ${chord.notes}`).toBe(true);
      expect(sounding.has(chroma(chord.tonic ?? '')), `${voicing.id} has root`).toBe(true);
      const isPowerOrSus = /5$|sus/.test(voicing.symbol);
      if (!isPowerOrSus) {
        const third = chord.intervals.find((i) => i === '3M' || i === '3m');
        expect(third, `${voicing.symbol} has a third interval`).toBeDefined();
        const thirdPc = chroma(Note.transpose(chord.tonic ?? '', third ?? ''));
        expect(sounding.has(thirdPc), `${voicing.id} sounds its third`).toBe(true);
      }
    },
  );

  it.each(SEED_VOICINGS.map((v) => [v.id, v] as const))(
    '%s fingering is physically plausible',
    (_id, voicing) => {
      const placements = fingerPlacements(voicing);
      // A finger used on several strings must sit on one fret and be declared as a barre covering them.
      const byFinger = new Map<string, typeof placements>();
      for (const p of placements)
        byFinger.set(String(p.finger), [...(byFinger.get(String(p.finger)) ?? []), p]);
      for (const [finger, list] of byFinger) {
        if (list.length < 2) continue;
        const frets = new Set(list.map((p) => p.fret));
        expect(frets.size, `${voicing.id} finger ${finger} on one fret`).toBe(1);
        const barre = voicing.barres?.find((b) => String(b.finger) === finger);
        expect(barre, `${voicing.id} finger ${finger} needs a barre`).toBeDefined();
        for (const p of list) {
          expect(p.idx >= (barre?.fromIdx ?? 99) && p.idx <= (barre?.toIdx ?? -1)).toBe(true);
        }
      }
      // Lower frets take lower finger numbers (monotone).
      for (const a of placements) {
        for (const b of placements) {
          if (a.finger === 'T' || b.finger === 'T') continue;
          if (a.fret < b.fret)
            expect(
              a.finger < b.finger,
              `${voicing.id}: fret ${a.fret} f${a.finger} vs fret ${b.fret} f${b.finger}`,
            ).toBe(true);
        }
      }
      // Played strings have a finger cell; muted strings have null.
      voicing.frets.forEach((fret, idx) => {
        if (fret === 'x') expect(voicing.fingers[idx]).toBeNull();
        else if (fret === 0) expect(voicing.fingers[idx]).toBe(0);
        else expect(typeof voicing.fingers[idx] === 'number' && voicing.fingers[idx] !== 0).toBe(true);
      });
    },
  );
});
