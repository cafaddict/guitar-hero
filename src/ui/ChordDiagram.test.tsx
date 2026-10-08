/** AC-U6: left-handed players see the diagram mirrored (6th string on the right). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { ChordDiagram, rootPitchClass, rootStrings } from './ChordDiagram';

/** x coordinate of each string's number label (idx 0 = 6th string). */
function labelXs(html: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of html.matchAll(/<text x="([\d.]+)" y="226"[^>]*>(\d)<\/text>/g))
    out.set(m[2]!, Number(m[1]));
  return out;
}

describe('ChordDiagram', () => {
  it('right-handed: 6th string on the left; left-handed: mirrored', () => {
    const c = voicingById('C');
    const right = labelXs(renderToStaticMarkup(<ChordDiagram voicing={c} />));
    const left = labelXs(renderToStaticMarkup(<ChordDiagram voicing={c} leftHanded />));
    expect(right.get('6')).toBeLessThan(right.get('1')!);
    expect(left.get('6')).toBeGreaterThan(left.get('1')!);
    expect(left.get('6')).toBe(right.get('1'));
  });

  it('describes the shape in text for screen readers', () => {
    const html = renderToStaticMarkup(<ChordDiagram voicing={voicingById('C')} />);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="C 코드 다이어그램: 6번 줄 치지 않음, 5번 줄 3프렛 3번 손가락/);
  });

  it('AC-UX3: marks the root notes with another shape and colour, and says where they are (v1.1 §12.1)', () => {
    expect(rootPitchClass('C')).toBe(0);
    expect(rootPitchClass('F#m')).toBe(6);
    expect(rootPitchClass('Bb7')).toBe(10);
    // C x32010: C3 on the 5th string (idx 1) and C4 on the 2nd string (idx 4).
    expect(rootStrings(voicingById('C'))).toEqual([1, 4]);
    // Em 022000: E on the 6th, 4th and 1st strings (E2, E3, E4).
    expect(rootStrings(voicingById('Em'))).toEqual([0, 2, 5]);
    const html = renderToStaticMarkup(<ChordDiagram voicing={voicingById('C')} />);
    expect(html.match(/data-root="true"/g)).toHaveLength(2);
    expect(html).toContain('루트음: 5, 2번 줄');
    expect(renderToStaticMarkup(<ChordDiagram voicing={voicingById('C')} showRoot={false} />)).not.toContain(
      'data-root',
    );
  });
});
