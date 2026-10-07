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

/** Every main screen of SPEC §12.1 (the practice screens in their running state). */
export const SCREENS: ScreenCase[] = [
  { name: 'onboarding', path: '/#/onboarding' },
  { name: 'home', path: '/#/' },
  { name: 'curriculum', path: '/#/curriculum' },
  { name: 'stage', path: '/#/curriculum/3' },
  { name: 'exam', path: '/#/exam' },
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
