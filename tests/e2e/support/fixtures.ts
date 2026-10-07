import { join } from 'node:path';
import type { Page } from '@playwright/test';

export const GENERATED_DIR = join(import.meta.dirname, '..', '..', 'fixtures', 'generated');

/** Serves tests/fixtures/generated/* at /fixtures/* for the page (the preview server only serves dist-e2e). */
export async function serveFixtures(page: Page): Promise<void> {
  await page.route('**/fixtures/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/fixtures/')[1] ?? '';
    await route.fulfill({ path: join(GENERATED_DIR, decodeURIComponent(name)), contentType: 'audio/wav' });
  });
}
