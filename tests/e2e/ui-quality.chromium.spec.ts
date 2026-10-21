import { expect, type Page, test } from '@playwright/test';
import { openScreen, SCREENS } from './support/screens';

/**
 * UI quality gates of the UI goal (docs/goal/ui/SPEC.md §5), part 2: UQ-6, UQ-7, UQ-8 and UQ-10, run in
 * Chromium only (playwright.config.ts CHROMIUM_ONLY): WebKit on macOS does not move focus to buttons and links
 * with Tab, and computed styles do not depend on the engine. Pinned by SHA-256 in the goal condition.
 */

async function firstScreen(page: Page, screen: (typeof SCREENS)[number]): Promise<void> {
  await openScreen(page, screen);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Two frames: let a scroll-triggered layout (sticky bars) settle before measuring.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  );
}

const THEMES = [
  ['dark', '다크'],
  ['light', '라이트'],
  ['contrast', '고대비'],
] as const;

async function switchTheme(page: Page, theme: string, label: string): Promise<void> {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: label }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

test('UQ-6: every element reached with Tab shows a 2 px focus outline, in every theme', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems: string[] = [];
  for (const [theme, themeLabel] of THEMES) {
    await switchTheme(page, theme, themeLabel);
    for (const screen of SCREENS) {
      await firstScreen(page, screen);
      // Start sequential focus navigation at the top of the document.
      await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
        document.body.removeAttribute('tabindex');
      });
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const path: string[] = [];
          for (let n: Element | null = el; n && n !== document.body; n = n.parentElement)
            path.unshift(`${n.tagName}${[...(n.parentElement?.children ?? [])].indexOf(n)}`);
          return {
            key: path.join('>'),
            label: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`,
            // An outline only: a box-shadow may be a permanent elevation, not a focus ring.
            ring: s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) >= 2,
            shown: r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight,
          };
        });
        if (!info || seen.has(info.key)) break;
        seen.add(info.key);
        if (!info.ring)
          problems.push(`UQ-6 ${theme} ${screen.name}: ${info.label} has no 2 px focus outline`);
        if (!info.shown)
          problems.push(`UQ-6 ${theme} ${screen.name}: ${info.label} is focused but not on screen`);
      }
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

/** UQ-8: transitions that animate a colour or opacity (a mid-transition frame can fail contrast). */
function transitionProblems(forbidden: string[]): string[] {
  const seconds = (t: string): number => Number.parseFloat(t) / (t.trim().endsWith('ms') ? 1000 : 1);
  const out: string[] = [];
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    // Durations pair with properties by position, the list repeating when shorter (CSS Transitions §2).
    const durations = s.transitionDuration.split(',').map(seconds);
    const bad = s.transitionProperty
      .split(',')
      .map((p) => p.trim())
      .filter((p, i) => forbidden.includes(p) && (durations[i % durations.length] ?? 0) > 0);
    if (bad.length > 0)
      out.push(
        `UQ-8 ${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join('.')} transitions ${bad.join(', ')}`,
      );
  }
  return out;
}

/** UQ-7: anything still moving while the user asked for reduced motion. */
function motionProblems(): string[] {
  const longest = (list: string): number =>
    Math.max(...list.split(',').map((t) => Number.parseFloat(t) / (t.trim().endsWith('ms') ? 1000 : 1)));
  const out: string[] = [];
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (longest(s.transitionDuration) > 0.01 || longest(s.animationDuration) > 0.01)
      out.push(
        `UQ-7 ${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join('.')} moves under reduced motion`,
      );
  }
  for (const a of document.getAnimations()) {
    const d = Number(a.effect?.getComputedTiming().duration ?? 0);
    if (d > 10) out.push(`UQ-7 a ${Math.round(d)} ms animation runs under reduced motion`);
  }
  if (getComputedStyle(document.documentElement).scrollBehavior === 'smooth')
    out.push('UQ-7 smooth scrolling under reduced motion');
  return out;
}

const FORBIDDEN_TRANSITIONS = [
  'all',
  'color',
  'background',
  'background-color',
  'opacity',
  'fill',
  'stroke',
  'outline-color',
  'text-decoration-color',
  'caret-color',
  '-webkit-text-fill-color',
  'visibility',
];

test('UQ-7 reduced motion, UQ-8 no colour or opacity transitions', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems: string[] = [];
  for (const screen of SCREENS) {
    // Opened under each preference: a transition already running when the preference flips keeps its length.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await firstScreen(page, screen);
    const transitions = await page.evaluate(transitionProblems, FORBIDDEN_TRANSITIONS);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Leave the screen first: going to the same URL again would not mount it afresh.
    await page.goto(screen.name === 'tools' ? '/#/progress' : '/#/tools');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await firstScreen(page, screen);
    const motion = await page.evaluate(motionProblems);
    problems.push(...[...transitions, ...motion].map((p) => `${screen.name}: ${p}`));
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const unique = [...new Set(problems)];
  expect(unique, unique.join('\n')).toEqual([]);
});

test('UQ-10: form field boundaries reach 3:1 against their surroundings, in every theme', async ({
  page,
}) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems: string[] = [];
  for (const [theme, themeLabel] of THEMES) {
    await switchTheme(page, theme, themeLabel);
    for (const screen of SCREENS) {
      await firstScreen(page, screen);
      const found = await page.evaluate(() => {
        type Rgba = [number, number, number, number];
        const parse = (c: string): Rgba | null => {
          let m = c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
          if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
          m = c.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/);
          if (m)
            return [
              Number(m[1]) * 255,
              Number(m[2]) * 255,
              Number(m[3]) * 255,
              m[4] === undefined ? 1 : Number(m[4]),
            ];
          // oklab()/oklch(): what Tailwind's opacity modifiers compute to (`bg-ok/30`).
          m = c.match(/^okl(ab|ch)\(([\d.e-]+%?|none) ([\d.e-]+|none) ([\d.e-]+|none)(?: \/ ([\d.]+%?))?\)$/);
          if (m) {
            const num = (v: string | undefined, scale = 1) =>
              v === undefined || v === 'none'
                ? 0
                : v.endsWith('%')
                  ? Number.parseFloat(v) / 100
                  : Number(v) * scale;
            const L = num(m[2]);
            let a = num(m[3]);
            let b = num(m[4]);
            if (m[1] === 'ch') {
              const h = (b * Math.PI) / 180;
              [a, b] = [a * Math.cos(h), a * Math.sin(h)];
            }
            const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
            const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
            const sv = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
            const lin = [
              4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * sv,
              -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * sv,
              -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * sv,
            ];
            const [r, g, bl] = lin.map(
              (v) =>
                255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)),
            ) as [number, number, number];
            return [r, g, bl, m[5] === undefined ? 1 : num(m[5])];
          }
          return null;
        };
        const over = (top: Rgba, under: Rgba): Rgba => [
          top[0] * top[3] + under[0] * (1 - top[3]),
          top[1] * top[3] + under[1] * (1 - top[3]),
          top[2] * top[3] + under[2] * (1 - top[3]),
          1,
        ];
        const lum = (c: Rgba): number => {
          const ch = c
            .slice(0, 3)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
            number,
            number,
            number,
          ];
          return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
        };
        const ratio = (a: Rgba, b: Rgba): number => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
          return (hi + 0.05) / (lo + 0.05);
        };
        /** The opaque colour painted behind `el` (its ancestors' backgrounds composited). */
        const behind = (el: Element): Rgba | null => {
          const layers: Rgba[] = [];
          for (let n = el.parentElement; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (!c) return null;
            if (c[3] > 0) layers.push(c);
            if (c[3] >= 1) break;
          }
          let base: Rgba = [255, 255, 255, 1];
          for (const layer of layers.reverse()) base = over(layer, base);
          return base;
        };
        const out: string[] = [];
        const fields = document.querySelectorAll(
          'select, textarea, input:not([type="hidden"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="button"]):not([type="submit"])',
        );
        for (const f of fields) {
          const r = f.getBoundingClientRect();
          if (r.width <= 1 || r.height <= 1) continue;
          const s = getComputedStyle(f);
          const back = behind(f);
          const fill = parse(s.backgroundColor);
          const border = parse(s.borderBottomColor);
          const name = `${f.tagName.toLowerCase()} "${(f.getAttribute('aria-label') ?? (f as HTMLInputElement).labels?.[0]?.textContent ?? '').trim().slice(0, 20)}"`;
          if (!back || !fill || !border) {
            out.push(`${name}: colour not parsed (${s.backgroundColor} / ${s.borderBottomColor})`);
            continue;
          }
          const filled = over(fill, back);
          const borderOk =
            Number.parseFloat(s.borderBottomWidth) >= 1 && ratio(over(border, filled), back) >= 3;
          const fillOk = ratio(filled, back) >= 3;
          if (!borderOk && !fillOk)
            out.push(
              `${name}: boundary ${ratio(over(border, filled), back).toFixed(2)}:1, fill ${ratio(filled, back).toFixed(2)}:1 (want ≥ 3:1)`,
            );
        }
        return out;
      });
      problems.push(...found.map((p) => `UQ-10 ${theme} ${screen.name}: ${p}`));
    }
  }
  expect([...new Set(problems)], problems.join('\n')).toEqual([]);
});
