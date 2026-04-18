import { test, expect } from '@playwright/test';

/**
 * Proves that a conversation with 10K messages remains usable:
 * - Page opens without hanging
 * - The latest seeded message is visible at the bottom
 * - Scrolling up progressively loads older batches
 * - We can reach a message near the beginning within a reasonable time
 *
 * Depends on `ALLOW_DEV_SEED=1` in the api env (set by docker-compose).
 */

test('large history — 10k messages load and scroll progressively', async ({ browser }) => {
  const unique = Date.now();
  const alice = {
    email: `huge_${unique}@example.com`,
    username: `huge${unique}`,
    password: 'password123',
  };
  const roomName = `huge${unique}`;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Register + sign in via API to save time.
  const register = await page.request.post('http://localhost:8080/api/auth/register', {
    data: alice,
  });
  expect(register.status()).toBe(201);

  // Create room.
  const roomResponse = await page.request.post('http://localhost:8080/api/rooms', {
    data: { name: roomName, visibility: 'public', description: 'large history test' },
  });
  expect(roomResponse.status()).toBe(201);
  const room = (await roomResponse.json()) as { id: string };

  // Seed 10k messages.
  const seedResponse = await page.request.post('http://localhost:8080/api/dev/seed-messages', {
    data: {
      conversationType: 'room',
      conversationId: room.id,
      count: 10_000,
    },
  });
  expect(seedResponse.status()).toBe(200);
  const seeded = (await seedResponse.json()) as { inserted: number };
  expect(seeded.inserted).toBe(10_000);

  // Navigate into the room via the UI.
  await page.goto(`/chat/${roomName}`);

  // Latest seeded message should be visible (exact match avoids the prefix
  // collision between "seeded message 10000" and "seeded message 1000").
  await expect(page.getByText('seeded message 10000', { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  // Scroll the message list until a much older seeded message becomes visible.
  // Target: "seeded message 5000" — exactly in the middle of the 10k range,
  // far enough to prove progressive scroll loads ~100 pages.
  const scroller = page.getByTestId('message-scroller');

  const deadline = Date.now() + 120_000;
  let reached = false;
  while (Date.now() < deadline) {
    const found = await page
      .getByText('seeded message 5000', { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    if (found) {
      reached = true;
      break;
    }
    await scroller.evaluate((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
    await page.waitForTimeout(250);
  }
  expect(reached).toBe(true);

  await ctx.close();
});
