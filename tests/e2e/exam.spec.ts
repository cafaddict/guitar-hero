import { expect, type Page, test } from '@playwright/test';
import { ko } from '../../src/i18n/ko';
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
      metrics: { hiddenMemorized: summary(1), hiddenCompleted: summary(1), completed: summary(1) },
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

test('exam: each step shows its result before the next; the next step can look back; one verdict (D-097)', async ({
  page,
}) => {
  test.setTimeout(150_000); // two 8-bar E5 runs on the audio clock
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.goto('/#/exam');
  const item4 = page.getByTestId('exam-item-4');
  await item4.getByRole('button', { name: '시작' }).click();

  const playStep = async () => {
    await item4.getByTestId('exercise-start').click();
    await expect(item4.getByTestId('armed-start')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(item4.getByTestId('e5-view')).toHaveAttribute('data-phase', 'review', { timeout: 60_000 });
    await page.keyboard.press('1');
  };

  // Step 1: its result stays until "다음 단계".
  await playStep();
  await expect(item4.getByTestId('exercise-summary')).toBeVisible();
  await expect(item4.getByTestId('exam-next-step')).toBeFocused();
  const stepOne = await item4.getByTestId('exercise-summary').innerText();
  await page.keyboard.press('Enter');

  // Step 2's start screen looks back at step 1's result (read-only) and returns.
  await expect(item4.getByTestId('exercise-start')).toBeVisible();
  await item4.getByTestId('exam-prev-result').click();
  const result = item4.getByTestId('exam-step-result');
  await expect(result).toHaveAttribute('data-step', '1');
  const shown = [ko.exercises.common.saved, ko.curriculum.examNextStep(2, 2)];
  for (const line of stepOne.split('\n').filter((l) => l.trim() && !shown.includes(l.trim())))
    await expect(result).toContainText(line.trim());
  await item4.getByTestId('exam-back-to-step').click();
  await expect(item4.getByTestId('exam-prev-result')).toBeVisible();

  // Step 2 is the last: the verdict follows at once and is recorded once.
  await playStep();
  await expect(item4.getByTestId('exam-prev-result')).toBeHidden();
  await expect(item4).toContainText(/통과|아직 기준에 못 미쳤어요/);
  const exams = (await examAttempts(page)).filter((a) => a.result.item === '4');
  expect(exams).toHaveLength(1);
});
