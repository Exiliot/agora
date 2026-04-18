import { test, expect } from '@playwright/test';

test('two users in the same public room see each other in real-time', async ({ browser }) => {
  const unique = Date.now();
  const alice = {
    email: `alice_${unique}@example.com`,
    username: `alice${unique}`,
    password: 'password123',
  };
  const bob = {
    email: `bob_${unique}@example.com`,
    username: `bob${unique}`,
    password: 'password123',
  };
  const roomName = `multi${unique}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const register = async (page: typeof pageA, creds: typeof alice) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type=email]').fill(creds.email);
    await page.locator('input[autocomplete=username]').fill(creds.username);
    await page.locator('input[autocomplete=new-password]').first().fill(creds.password);
    await page.locator('input[autocomplete=new-password]').nth(1).fill(creds.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(/\/chat/, { timeout: 10_000 });
  };

  await register(pageA, alice);
  await register(pageB, bob);

  // Alice creates the room
  await pageA.getByRole('button', { name: /Create room/i }).click();
  const dialog = pageA.getByRole('dialog', { name: /Create room/i });
  await dialog.locator('input').first().fill(roomName);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await pageA.waitForURL(new RegExp(`/chat/${roomName}`), { timeout: 10_000 });

  // Bob joins via the public catalogue — narrow down to the specific room we just made
  await pageB.goto('/public');
  await pageB.waitForLoadState('networkidle');
  await pageB.getByPlaceholder('Search rooms…').fill(roomName);
  await expect(pageB.getByText(`# ${roomName}`)).toBeVisible({ timeout: 10_000 });
  await pageB
    .locator('div', { hasText: new RegExp(`^# ${roomName}`) })
    .getByRole('button', { name: 'Join' })
    .first()
    .click();
  await pageB.waitForURL(new RegExp(`/chat/${roomName}`), { timeout: 10_000 });

  // Bob sends a message
  await pageB.getByPlaceholder('Type a message…').fill('hello from bob');
  await pageB.getByRole('button', { name: 'Send' }).click();

  // Alice sees it in real time
  await expect(pageA.getByText('hello from bob').first()).toBeVisible({ timeout: 10_000 });

  // Alice replies
  await pageA.getByPlaceholder('Type a message…').fill('hi bob from alice');
  await pageA.getByRole('button', { name: 'Send' }).click();

  // Bob sees it
  await expect(pageB.getByText('hi bob from alice').first()).toBeVisible({ timeout: 10_000 });

  await contextA.close();
  await contextB.close();
});
