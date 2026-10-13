/** SPEC v1.1 §6.9: the TAB renderer — top line = 1st string, current note highlighted, hidden numbers. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { riffById, riffNotes } from '../content/riffs';
import { Tab } from './Tab';

/** y of each rendered fret number, in note order. */
function numberYs(html: string): number[] {
  return [...html.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)].map((m) => Number(m[1]));
}

describe('Tab', () => {
  it('puts the 1st string on the top line and the 6th on the bottom', () => {
    const html = renderToStaticMarkup(
      <Tab
        notes={[
          { string: 1, fret: 0 },
          { string: 6, fret: 3 },
        ]}
        label="t"
      />,
    );
    const [high, low] = numberYs(html);
    expect(high).toBeLessThan(low!);
    expect(html).toContain('>0</text>');
    expect(html).toContain('>3</text>');
  });

  it('renders every riff note, highlights the current one and hides only the numbers when hidden', () => {
    const notes = riffNotes(riffById('R1'));
    const shown = renderToStaticMarkup(<Tab notes={notes} current={5} label="R1" />);
    expect(numberYs(shown)).toHaveLength(16);
    expect(shown.match(/data-active="true"/g)).toHaveLength(1);
    const hidden = renderToStaticMarkup(<Tab notes={notes} current={5} hidden label="R1" />);
    expect(numberYs(hidden)).toHaveLength(0);
    expect(hidden.match(/<rect/g)).toHaveLength(16);
    expect(hidden).toContain('aria-label="R1"');
  });

  it('labels the lines with string numbers 1–6, draws bar lines and a finger row (D-080)', () => {
    const notes = riffNotes(riffById('R1'));
    const html = renderToStaticMarkup(
      <Tab notes={notes} label="R1" barSize={4} fingers={notes.map((n) => n.finger)} />,
    );
    const strings = [...html.matchAll(/data-role="string-number"[^>]*>(\d)<\/text>/g)].map((m) => m[1]);
    expect(strings).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(html.match(/data-role="bar-line"/g)).toHaveLength(3);
    const fingers = [...html.matchAll(/data-role="finger"[^>]*>(\d)<\/text>/g)].map((m) => Number(m[1]));
    expect(fingers).toEqual(notes.filter((n) => n.fret > 0).map((n) => n.finger));
    // Hidden (memorization): the fingers would give the frets away, so they hide with the numbers.
    const hidden = renderToStaticMarkup(
      <Tab notes={notes} label="R1" hidden barSize={4} fingers={notes.map((n) => n.finger)} />,
    );
    expect(hidden).not.toContain('data-role="finger"');
    expect(hidden).toContain('data-role="string-number"');
  });
});
