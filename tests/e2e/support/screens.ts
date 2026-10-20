import { expect, type Page } from '@playwright/test';

export interface ScreenCase {
  name: string;
  path: string;
  /** Brings the screen into its main state (e.g. starts the exercise without a microphone). */
  prepare?: (page: Page) => Promise<void>;
  practice?: boolean;
}

const startWithoutMic = async (page: Page) => {
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
};

/**
 * A practice screen in its main state: started (with the start button, or "마이크 없이 쓰기" for microphone
 * exercises) and, for the sequence exercises, running (self-report buttons shown).
 */
function practiceAfter(
  type: string,
  path: string,
  start: 'start' | 'noMic',
  view: string,
  run = false,
): ScreenCase {
  return {
    name: `practice-${type}`,
    path,
    practice: true,
    prepare: async (page) => {
      if (start === 'noMic') await startWithoutMic(page);
      else await page.getByTestId('exercise-start').click();
      await expect(page.getByTestId(view)).toBeVisible();
      if (run) {
        await page.keyboard.press('Space');
        await expect(page.getByTestId('seq-flawless')).toBeVisible({ timeout: 20_000 });
      }
    },
  };
}

/** Every main screen of SPEC §12.1 (the practice screens in their running state). */
export const SCREENS: ScreenCase[] = [
  { name: 'onboarding', path: '/#/onboarding' },
  { name: 'home', path: '/#/' },
  { name: 'curriculum', path: '/#/curriculum' },
  { name: 'stage', path: '/#/curriculum/3' },
  { name: 'stage-practice', path: '/#/curriculum/1/practice/0' },
  { name: 'exam', path: '/#/exam' },
  // D-087: the 도구 tab's hub screen.
  { name: 'tools', path: '/#/tools' },
  { name: 'library', path: '/#/library' },
  { name: 'chord', path: '/#/library/C' },
  { name: 'tuner', path: '/#/tuner' },
  { name: 'metronome', path: '/#/metronome' },
  { name: 'progress', path: '/#/progress' },
  { name: 'settings', path: '/#/settings' },
  { name: 'diagnostics', path: '/#/settings/diagnostics' },
  { name: 'recording', path: '/#/settings/recording' },
  {
    name: 'practice-E1',
    path: '/#/practice/E1?voicingId=C',
    practice: true,
    prepare: async (page) => {
      await startWithoutMic(page);
      await expect(page.getByTestId('e1-view')).toBeVisible();
    },
  },
  {
    name: 'practice-E2',
    path: '/#/practice/E2?from=A&to=D',
    practice: true,
    prepare: async (page) => {
      await startWithoutMic(page);
      await expect(page.getByTestId('e2-view')).toBeVisible();
    },
  },
  {
    name: 'practice-E5',
    path: '/#/practice/E5?patternId=P3&bpm=80',
    practice: true,
    prepare: async (page) => {
      await startWithoutMic(page);
      await expect(page.getByTestId('e5-view')).toBeVisible();
    },
  },
  {
    name: 'practice-Q1',
    path: '/#/practice/Q1',
    practice: true,
    prepare: async (page) => {
      await page.getByTestId('exercise-start').click();
      await expect(page.getByTestId('q1-view')).toBeVisible();
    },
  },
  // v1.1 screens (SPEC v1.1 §12, AC-UX4).
  { name: 'stage-10', path: '/#/curriculum/10' },
  { name: 'routine-edit', path: '/#/routine/edit' },
  practiceAfter('K1', '/#/practice/K1', 'start', 'k1-view'),
  practiceAfter('E16', '/#/practice/E16', 'noMic', 'e16-view'),
  practiceAfter('E3', '/#/practice/E3?from=G&to=D', 'noMic', 'e3-view'),
  practiceAfter('E9', '/#/practice/E9', 'noMic', 'e9-view', true),
  practiceAfter('E10', '/#/practice/E10?scaleId=em-pent-open', 'noMic', 'e10-view', true),
  practiceAfter('E11', '/#/practice/E11', 'noMic', 'e11-view', true),
  practiceAfter('E12', '/#/practice/E12', 'start', 'e12-view'),
  practiceAfter('E17', '/#/practice/E17?riffId=R3&bpm=70', 'noMic', 'e17-view', true),
  // D-079/D-080: the start screen with its open "하는 법", and the riff before its run (words, 들어 보기).
  { name: 'practice-E17-how-to', path: '/#/practice/E17?riffId=R1&bpm=60', practice: true },
  practiceAfter('E17-ready', '/#/practice/E17?riffId=R1&bpm=60', 'noMic', 'e17-spelled'),
  practiceAfter('Q3', '/#/practice/Q3?scope=strings65', 'noMic', 'q3-view'),
  practiceAfter('Q4', '/#/practice/Q4?kind=interval', 'start', 'q4-view'),
  practiceAfter('Q5', '/#/practice/Q5', 'start', 'q5-view'),
  practiceAfter('S-perform', '/#/practice/S?songId=s15&mode=perform&backingOn=true', 'noMic', 'song-view'),
  // D-085: a paused song (hidden stage): the pause/resume button, the paused panel and the restart button.
  {
    name: 'practice-S-paused',
    path: '/#/practice/S?songId=s01&mode=perform&bpm=120&chartHidden=true',
    practice: true,
    prepare: async (page) => {
      await startWithoutMic(page);
      const view = page.getByTestId('song-view');
      await expect(view).toHaveAttribute('data-phase', 'ready');
      await page.keyboard.press('Space');
      await expect(view).toHaveAttribute('data-phase', 'running', { timeout: 20_000 });
      await page.keyboard.press('p');
      await expect(page.getByTestId('exercise-paused')).toBeVisible();
    },
  },
  {
    name: 'session',
    path: '/#/session',
    practice: true,
    prepare: async (page) => {
      await expect(page.getByTestId('session-header')).toBeVisible();
    },
  },
];

/** Opens a screen; the first visit of a fresh profile is sent to onboarding, so "later" is chosen once. */
export async function openScreen(page: Page, screen: ScreenCase): Promise<void> {
  await page.goto(screen.path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await screen.prepare?.(page);
}
