import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ko } from '../../i18n/ko';
import { HowToPanel } from './HowToPanel';

describe('HowToPanel (D-079)', () => {
  const howTo = { steps: ['첫 단계', '둘째 단계'], terms: ['tab', 'fingerNumbers'] as const };

  it('is open before the run and lists the steps in order with the glossary', () => {
    const html = renderToStaticMarkup(<HowToPanel howTo={howTo} open />);
    expect(html).toMatch(/<details[^>]*open=""/);
    expect(html.indexOf('첫 단계')).toBeLessThan(html.indexOf('둘째 단계'));
    expect(html).toContain(ko.exercises.guide.terms.tab.name);
    expect(html.match(/data-term=/g)).toHaveLength(2);
  });

  it('is folded while running and has no glossary heading without terms', () => {
    const html = renderToStaticMarkup(<HowToPanel howTo={{ steps: ['a'], terms: [] }} open={false} />);
    expect(html).not.toMatch(/<details[^>]*open/);
    expect(html).not.toContain(ko.exercises.guide.termsTitle);
  });
});
