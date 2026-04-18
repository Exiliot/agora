import { test, expect } from '@playwright/test';

test('api health endpoint returns ok', async ({ request }) => {
  const response = await request.get('http://localhost:3000/health');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { status: string; db: boolean };
  expect(body.status).toBe('ok');
  expect(body.db).toBe(true);
});

test('web root renders the agora wordmark', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('body')).toContainText(/agora/i);
});

test('register + me + create room round-trip works', async ({ request }) => {
  const unique = Date.now();
  const email = `smoke_${unique}@example.com`;
  const username = `smk${unique}`;
  const password = 'smoke1234';

  const register = await request.post('http://localhost:3000/api/auth/register', {
    data: { email, username, password },
  });
  expect(register.status()).toBe(201);

  const me = await request.get('http://localhost:3000/api/auth/me');
  expect(me.status()).toBe(200);
  const meBody = (await me.json()) as { user: { username: string } };
  expect(meBody.user.username).toBe(username);

  const createRoom = await request.post('http://localhost:3000/api/rooms', {
    data: { name: `room-${unique}`, visibility: 'public', description: 'smoke' },
  });
  expect(createRoom.status()).toBe(201);
});
