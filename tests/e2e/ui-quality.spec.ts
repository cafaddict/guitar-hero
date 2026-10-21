import { expect, type Page, test } from '@playwright/test';
import { openScreen, SCREENS } from './support/screens';

/**
 * UI quality gates of the UI goal (docs/goal/ui/SPEC.md §5), part 1: UQ-1–UQ-5 and UQ-9 in every browser.
 * Part 2 (UQ-6, UQ-7, UQ-8, UQ-10) is ui-quality.chromium.spec.ts. Both are pinned by SHA-256 in the goal
 * condition: the run makes them pass and never edits them.
 *
 * Every check looks at a screen of `support/screens.ts` in its prepared state, scrolled to the top — the first
 * screen a learner sees — and collects all problems before asserting, so one run lists them all.
 */

const VIEWPORTS = [
  { name: 'macbook', width: 1440, height: 900 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'iphone', width: 390, height: 844 },
] as const;
const WIDE = new Set(['macbook', 'ipad-landscape']);

/** Coverage only grows: these screens must stay in SCREENS. */
const REQUIRED_SCREENS = [
  'onboarding',
  'home',
  'curriculum',
  'stage',
  'stage-practice',
  'exam',
  'tools',
  'library',
  'chord',
  'tuner',
  'metronome',
  'progress',
  'settings',
  'diagnostics',
  'recording',
  'practice-E1',
  'practice-E2',
  'practice-E5',
  'practice-Q1',
  'stage-10',
  'routine-edit',
  'practice-K1',
  'practice-E16',
  'practice-E3',
  'practice-E9',
  'practice-E10',
  'practice-E11',
  'practice-E12',
  'practice-E17',
  'practice-E17-how-to',
  'practice-E17-ready',
  'practice-Q3',
  'practice-Q4',
  'practice-Q5',
  'practice-S-perform',
  'practice-S-paused',
  'session',
];

/** A control a primary region must hold: by test id or by accessible name (regular expression source). */
type Expect = { testid: string } | { name: string };
const id = (testid: string): Expect => ({ testid });
const named = (name: string): Expect => ({ name });

/**
 * UQ-1 (practice screens) and UQ-2 (app screens): the one next step of each prepared state, which the
 * `[data-primary-action]` region must hold (any of the listed controls) — SPEC §5.1.
 */
const PRIMARY: Record<string, { gate: 'UQ-1' | 'UQ-2'; expect: Expect[] }> = {
  onboarding: { gate: 'UQ-2', expect: [named('마이크 허용')] },
  home: { gate: 'UQ-2', expect: [id('start-session'), id('resume-session')] },
  stage: { gate: 'UQ-2', expect: [id('stage-practice-now'), id('stage-practice-start')] },
  'stage-10': { gate: 'UQ-2', expect: [id('stage-practice-now'), id('stage-practice-start')] },
  tuner: { gate: 'UQ-2', expect: [named('튜너 (켜기|끄기)')] },
  metronome: { gate: 'UQ-2', expect: [id('metronome-toggle')] },
  'routine-edit': { gate: 'UQ-2', expect: [id('editor-save')] },
  'stage-practice': { gate: 'UQ-1', expect: [id('exercise-start'), named('마이크 없이 쓰기')] },
  'practice-E1': { gate: 'UQ-1', expect: [named('준비됐어요')] },
  'practice-E2': { gate: 'UQ-1', expect: [named('^시작')] },
  'practice-E3': { gate: 'UQ-1', expect: [named('^시작')] },
  'practice-E5': { gate: 'UQ-1', expect: [named('^시작')] },
  'practice-E12': { gate: 'UQ-1', expect: [named('^시작')] },
  'practice-Q1': { gate: 'UQ-1', expect: [named('^1\\.')] },
  'practice-Q3': { gate: 'UQ-1', expect: [named('^1\\.')] },
  'practice-Q4': { gate: 'UQ-1', expect: [named('^1\\.')] },
  'practice-Q5': { gate: 'UQ-1', expect: [named('^1\\.')] },
  'practice-K1': { gate: 'UQ-1', expect: [id('k1-done')] },
  'practice-E16': { gate: 'UQ-1', expect: [named('깨끗')] },
  'practice-E9': { gate: 'UQ-1', expect: [id('seq-flawless')] },
  'practice-E10': { gate: 'UQ-1', expect: [id('seq-flawless')] },
  'practice-E11': { gate: 'UQ-1', expect: [id('seq-flawless')] },
  'practice-E17': { gate: 'UQ-1', expect: [id('seq-flawless')] },
  'practice-E17-how-to': { gate: 'UQ-1', expect: [id('exercise-start'), named('마이크 없이 쓰기')] },
  // Ready to run: today only Space starts it, so a touch start control is needed (SPEC §4.2).
  'practice-E17-ready': { gate: 'UQ-1', expect: [named('시작')] },
  'practice-S-perform': { gate: 'UQ-1', expect: [named('^시작')] },
  'practice-S-paused': { gate: 'UQ-1', expect: [id('exercise-pause')] },
  session: { gate: 'UQ-1', expect: [id('exercise-start'), named('마이크 없이 쓰기')] },
};
/** Controls that are never the next step: leaving, finishing, the app navigation. */
const NOT_PRIMARY =
  '[data-testid="focus-exit"], [data-testid="exercise-finish"], [data-testid="seq-finish"], [data-testid="end-session"], nav';
/** UQ-3: screens whose prepared state shows a key number (remaining time, BPM). */
const CORE_REQUIRED = new Set(['practice-E1', 'practice-E5']);

const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="slider"], [tabindex]:not([tabindex="-1"])';

async function firstScreen(page: Page, screen: (typeof SCREENS)[number]): Promise<void> {
  await openScreen(page, screen);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Two frames: let a scroll-triggered layout (sticky bars) settle before measuring.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  );
}

interface WalkOptions {
  primary: { gate: 'UQ-1' | 'UQ-2'; expect: Expect[] } | null;
  notPrimary: string;
  wide: boolean;
  phone: boolean;
}

/** UQ-1/UQ-2 (primary), UQ-3 (key numbers), UQ-4 (targets), UQ-5 (Korean breaking, phone), UQ-9 (line length, wide). */
function measure(opts: WalkOptions & { selector: string }): string[] {
  const { selector } = opts;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const problems: string[] = [];
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden';
  };
  const ownText = (el: Element): boolean =>
    [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
  const label = (el: Element): string =>
    `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;

  if (opts.primary) {
    const { gate, expect: wanted } = opts.primary;
    const regions = [...document.querySelectorAll('[data-primary-action]')].filter(visible);
    if (regions.length !== 1)
      problems.push(`${gate} ${regions.length} visible [data-primary-action] (want exactly 1)`);
    const region = regions[0];
    if (region) {
      const r = region.getBoundingClientRect();
      if (r.top < 0 || r.left < 0 || r.bottom > vh + 0.5 || r.right > vw + 0.5)
        problems.push(
          `${gate} primary region outside the first screen (bottom ${Math.round(r.bottom)} / ${vh})`,
        );
      if (r.width * r.height > 0.5 * vw * vh)
        problems.push(`${gate} primary region covers more than half the screen`);
      if (region.matches(opts.notPrimary) || region.querySelector(opts.notPrimary))
        problems.push(`${gate} primary region holds an exit, finish or navigation control`);
      const controls = region.matches(selector)
        ? [region]
        : [...region.querySelectorAll(selector)].filter(visible);
      const name = (c: Element) =>
        (c.getAttribute('aria-label') ?? c.textContent ?? '').trim().replace(/\s+/g, ' ');
      const holds = controls.some((c) =>
        wanted.some((w) =>
          'testid' in w ? c.getAttribute('data-testid') === w.testid : new RegExp(w.name).test(name(c)),
        ),
      );
      if (!holds)
        problems.push(
          `${gate} primary region lacks ${wanted.map((w) => ('testid' in w ? `#${w.testid}` : `/${w.name}/`)).join(' or ')}`,
        );
      for (const c of controls) {
        const cr = c.getBoundingClientRect();
        const x = cr.left + cr.width / 2;
        const y = cr.top + cr.height / 2;
        const hit = x >= 0 && x < vw && y >= 0 && y < vh ? document.elementFromPoint(x, y) : null;
        if (!hit || !(hit === c || c.contains(hit)))
          problems.push(`${gate} ${label(c)} is covered or off screen`);
      }
    }
  }

  for (const el of document.querySelectorAll('[data-core-number]')) {
    if (!visible(el)) continue;
    // The largest text inside counts: a big wrapper around small digits is not a big number.
    const sizes = [el, ...el.querySelectorAll('*')]
      .filter((n) => visible(n) && ownText(n))
      .map((n) => Number.parseFloat(getComputedStyle(n).fontSize));
    const ratio = Math.max(0, ...sizes) / vh;
    if (ratio < 0.15 - 0.0005 || ratio > 0.25 + 0.0005)
      problems.push(`UQ-3 ${label(el)} font-size ${(ratio * 100).toFixed(1)}% of the height (want 15–25%)`);
    const r = el.getBoundingClientRect();
    if (r.left < 0 || r.right > vw + 0.5) problems.push(`UQ-3 ${label(el)} wider than the screen`);
  }

  for (const el of document.querySelectorAll(selector)) {
    if (!visible(el)) continue;
    if (el.tagName === 'A' && el.closest('p')) continue; // inline link in running text (WCAG 2.5.8 exception)
    let target: Element = el;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && el.labels?.[0])
      target = el.labels[0];
    const r = target.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5)
      problems.push(`UQ-4 ${label(el)} target ${Math.round(r.width)}×${Math.round(r.height)} (want ≥ 44×44)`);
  }

  if (opts.phone) {
    const body = getComputedStyle(document.body);
    if (body.wordBreak !== 'keep-all')
      problems.push(`UQ-5 body word-break ${body.wordBreak} (want keep-all)`);
    for (const el of document.querySelectorAll('body *')) {
      if (!ownText(el) || !visible(el) || el.closest('pre, code, kbd, samp, svg')) continue;
      const s = getComputedStyle(el);
      if (s.wordBreak !== 'keep-all') problems.push(`UQ-5 ${label(el)} word-break ${s.wordBreak}`);
      else if (s.overflowWrap === 'normal') problems.push(`UQ-5 ${label(el)} overflow-wrap normal`);
    }
  }

  if (opts.wide) {
    for (const el of document.querySelectorAll('p')) {
      if (!ownText(el) || !visible(el) || el.closest('table, pre, svg, [data-core-number]')) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const em = range.getBoundingClientRect().width / Number.parseFloat(getComputedStyle(el).fontSize);
      if (em > 48) problems.push(`UQ-9 ${label(el)} line ${em.toFixed(0)}em long (want ≤ 48em)`);
    }
  }
  return problems;
}

test('UQ-1–5, UQ-9: first screen of every screen × 4 viewports', async ({ page }) => {
  test.setTimeout(600_000);
  const names = new Set(SCREENS.map((s) => s.name));
  const problems = [...REQUIRED_SCREENS, ...Object.keys(PRIMARY)]
    .filter((n) => !names.has(n))
    .map((n) => `screen ${n} missing from SCREENS`);
  for (const s of SCREENS)
    if (s.practice && !PRIMARY[s.name]) problems.push(`practice screen ${s.name} has no PRIMARY entry`);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const screen of SCREENS) {
      await firstScreen(page, screen);
      const found = await page.evaluate(measure, {
        selector: INTERACTIVE,
        primary: PRIMARY[screen.name] ?? null,
        notPrimary: NOT_PRIMARY,
        wide: WIDE.has(viewport.name),
        phone: viewport.name === 'iphone',
      });
      if (CORE_REQUIRED.has(screen.name) && (await page.locator('[data-core-number]:visible').count()) === 0)
        found.push('UQ-3 no visible [data-core-number]');
      problems.push(...found.map((p) => `${viewport.name} ${screen.name}: ${p}`));
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
