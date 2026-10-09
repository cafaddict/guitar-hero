/** M14 (SPEC v1.1 §12.1): the fret-position picture follows the left-handed setting; the TAB never does (§6.9). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tab } from '../../ui/Tab';
import { PositionPicture } from './plugin';

describe('left-handed pictures', () => {
  it('the fret space is mirrored for a left-handed player', () => {
    const right = renderToStaticMarkup(<PositionPicture pos="behind" />);
    const left = renderToStaticMarkup(<PositionPicture pos="behind" leftHanded />);
    expect(right).not.toContain('scale(-1 1)');
    expect(left).toContain('transform="translate(160 0) scale(-1 1)"');
  });

  it('the TAB keeps the TAB convention (no left-handed prop, 1st string on top)', () => {
    const html = renderToStaticMarkup(<Tab notes={[{ string: 1, fret: 0 }]} label="t" />);
    expect(html).not.toContain('scale(-1');
  });
});
