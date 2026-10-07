import { expect, type Page, test } from '@playwright/test';
import { putRows, readStore } from './support/idb';

interface Progression {
  exam: Record<string, number>;
}

interface ExamAttempt {
  exerciseType: string;
  endedAt: number;
  result: { item: string; passed: boolean; detail: Record<string, unknown> };
}

/** EXAM attempts in time order (rows come back in random primary-key order). */
async function examAttempts(page: Page): Promise<ExamAttempt[]> {
  return (await readStore<ExamAttempt>(page, 'attempts'))
    .filter((a) => a.exerciseType === 'EXAM')
    .sort((a, b) => a.endedAt - b.endedAt);
}

test('graduation exam: items are checked one by one, attempts recorded, passes kept (SPEC §7.6)', async ({
  page,
}) => {
  await page.goto('/#/exam');
  const item5 = page.getByTestId('exam-item-5');
  await expect(item5).toHaveAttribute('data-passed', 'false');

  // Item 5 without hidden-chart completions: checked, not passed, recorded.
  await item5.getByRole('button', { name: '결과 확인' }).click();
  await expect(item5).toContainText('아직 기준에 못 미쳤어요');
  expect((await examAttempts(page)).map((a) => a.result)).toEqual([
    { item: '5', passed: false, detail: { songs: 0 } },
  ]);

  // Five songs completed with the chart hidden → item 5 passes and stays passed.
  const summary = (best: number) => ({
    count: 1,
    last: best,
    best,
    lastAt: 1,
    firstAt: 1,
    recent: [best],
    dayBest: {},
  });
  await putRows(
    page,
    'skills',
    ['s01', 's02', 's03', 's04', 's05'].map((id) => ({
      subjectKey: `song:${id}`,
      lastPracticedAt: 1,
      due: null,
      metrics: { hiddenCompleted: summary(1), completed: summary(1) },
    })),
  );
  await page.reload();
  await page.getByTestId('exam-item-5').getByRole('button', { name: '결과 확인' }).click();
  await expect(page.getByTestId('exam-item-5')).toHaveAttribute('data-passed', 'true');
  expect((await examAttempts(page)).map((a) => a.result.passed)).toEqual([false, true]);
  const progression = await readStore<Progression>(page, 'progression');
  expect(Object.keys(progression[0]!.exam)).toEqual(['5']);
  await page.reload();
  await expect(page.getByTestId('exam-item-5')).toHaveAttribute('data-passed', 'true');
});
