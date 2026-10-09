import { expect, type Page, test } from '@playwright/test';
import { stageDef } from '../../src/content/curriculum';
import { PRACTICE_SONGS } from '../../src/content/songs';
import { dayKey } from '../../src/domain/records';
import { putRows, readStore } from './support/idb';

const DAY = 86_400_000;
const pairRule = stageDef(11).unlockRules.find((r) => r.kind === 'pairsPassedAtLeast');
const STAGE11_PAIRS = pairRule?.kind === 'pairsPassedAtLeast' ? pairRule.pairs : [];

interface Progression {
  stage: number;
  sessionsInStage: number;
  stageEnteredAt: number;
  completedBeginner1: boolean;
  completedBeginner2: boolean;
  beginner2CompletedAt?: number;
}

/** A skill row whose metric `name` reached `value` on the given days (SPEC §13 skill summary). */
function skill(subjectKey: string, metrics: Record<string, { value: number; days: number[] }>, at: number) {
  return {
    subjectKey,
    lastPracticedAt: at,
    due: null,
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([name, { value, days }]) => [
        name,
        {
          count: days.length,
          last: value,
          best: value,
          lastAt: Math.max(...days),
          firstAt: Math.min(...days),
          recent: days.map(() => value),
          dayBest: Object.fromEntries(days.map((d) => [dayKey(d), value])),
        },
      ]),
    ),
  };
}

async function progression(page: Page): Promise<Progression> {
  return (await readStore<Progression>(page, 'progression'))[0]!;
}

test('E2E-19: Stage 10 rules met → Stage 11 → 15 days and 8 sessions later Stage 11 rules met → 초급 2 수료', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);

  // Stage 10 entered 15 days ago, 8 sessions; its rules met (Q3 strings 6/5, A minor pentatonic, 2 songs).
  const exam = Object.fromEntries(['1', '2', '3', '4', '5'].map((k) => [k, t0 - 90 * DAY]));
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 10,
      stageEnteredAt: t0 - 15 * DAY,
      sessionsInStage: 8,
      gVoicing: 'G-4f',
      history: [],
      exam,
      completedBeginner1: true,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);
  const yesterday = t0 - DAY;
  const stage10Songs = PRACTICE_SONGS.filter((s) => s.stage === 10).slice(0, 2);
  await putRows(page, 'skills', [
    skill('quiz:notes:strings65', { qualifiedAccuracy: { value: 0.95, days: [yesterday] } }, yesterday),
    skill('scale:am-pent-pos1:s1', { streakBpm: { value: 80, days: [yesterday] } }, yesterday),
    ...stage10Songs.map((s) =>
      skill(`song:${s.id}`, { performCompleted: { value: 1, days: [yesterday] } }, yesterday),
    ),
  ]);
  await page.reload();
  const stageCard = page.getByTestId('stage-card');
  await expect(stageCard).toContainText('Stage 10');
  await page.getByTestId('promote-now').click();
  await expect(stageCard).toContainText('Stage 11');
  expect(await progression(page)).toMatchObject({ stage: 11, sessionsInStage: 0, completedBeginner2: false });

  // 15 days later with 8 Stage 11 sessions: 7th chords recalled, 6 dominant-7th pairs passed, a Stage 11 song.
  const t15 = t0 + 15 * DAY;
  await page.clock.setSystemTime(t15);
  await putRows(
    page,
    'sessions',
    Array.from({ length: 8 }, (_, k) => {
      const startedAt = t0 + (k + 1) * DAY;
      return {
        id: `seed-s11-${k}`,
        startedAt,
        endedAt: startedAt + 30 * 60_000,
        routineId: null,
        plannedItems: 10,
        completedItems: 10,
        selfReport: null,
        stage: 11,
      };
    }),
  );
  await putRows(page, 'progression', [{ ...(await progression(page)), key: 'current', sessionsInStage: 8 }]);
  const days = [t0 + 3 * DAY, t0 + 6 * DAY];
  await putRows(page, 'skills', [
    ...['A7', 'D7', 'E7', 'G7', 'C7', 'B7'].map((c) =>
      skill(`recall:${c}`, { pass: { value: 1, days } }, days[1]!),
    ),
    ...STAGE11_PAIRS.slice(0, pairRule?.kind === 'pairsPassedAtLeast' ? pairRule.minCount : 0).map((id) =>
      skill(`pair:${id}`, { cpmQualified: { value: 32, days } }, days[1]!),
    ),
    skill(
      `song:${PRACTICE_SONGS.find((s) => s.stage === 11)!.id}`,
      { performCompleted: { value: 1, days: [days[1]!] } },
      days[1]!,
    ),
  ]);
  await page.reload();
  await expect(stageCard).toContainText('Stage 11');
  await expect(stageCard).toContainText('초급 2 수료를 기록할까요?');
  await page.getByTestId('promote-now').click();
  await expect(page.getByTestId('beginner2-done')).toContainText('초급 2 수료!');
  const done = await progression(page);
  expect(done).toMatchObject({ stage: 11, completedBeginner1: true, completedBeginner2: true });
  expect(Math.abs(done.beginner2CompletedAt! - t15)).toBeLessThan(DAY);
  await page.reload();
  await expect(page.getByTestId('beginner2-done')).toBeVisible();
  await page.goto('/#/curriculum');
  await expect(page.getByTestId('curriculum-beginner2')).toContainText('초급 2 수료!');
});
