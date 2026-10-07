/** AC-U6: left-handed players see the diagram mirrored (6th string on the right). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { ChordDiagram } from './ChordDiagram';

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
});
