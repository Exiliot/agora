import { test, expect } from '@playwright/test';

test('api health endpoint returns ok', async ({ request }) => {
  const response = await request.get('http://localhost:3000/health');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { status: string; db: boolean };
  expect(body.status).toBe('ok');
  expect(body.db).toBe(true);
});

test('web root renders the agora wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toContainText(/agora/i);
  await expect(page.getByText(/scaffolding · day 1/i)).toBeVisible();
});

test('web talks to api through the nginx proxy (/api and /ws)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/state: open/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/echo reply: hello from agora/i)).toBeVisible({ timeout: 10_000 });
});
