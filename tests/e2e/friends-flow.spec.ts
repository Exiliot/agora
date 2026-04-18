import { test, expect, type Page } from '@playwright/test';

const register = async (page: Page, creds: { email: string; username: string; password: string }) => {
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type=email]').fill(creds.email);
  await page.locator('input[autocomplete=username]').fill(creds.username);
  await page.locator('input[autocomplete=new-password]').first().fill(creds.password);
  await page.locator('input[autocomplete=new-password]').nth(1).fill(creds.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/chat/, { timeout: 10_000 });
};

test('friend request → accept → dm message round-trip via UI', async ({ browser }) => {
  const unique = Date.now();
  const alice = {
    email: `friend_a_${unique}@example.com`,
    username: `fra${unique}`,
    password: 'password123',
  };
  const bob = {
    email: `friend_b_${unique}@example.com`,
    username: `frb${unique}`,
    password: 'password123',
  };

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await register(pageA, alice);
  await register(pageB, bob);

  // Alice navigates to contacts and sends friend request to Bob
  await pageA.goto('/contacts');
  await pageA.waitForLoadState('networkidle');
  await pageA.getByPlaceholder('Search users by username…').fill(bob.username);
  await expect(pageA.getByText(bob.username).first()).toBeVisible({ timeout: 10_000 });
  await pageA.getByRole('button', { name: 'Add friend' }).first().click();

  // Bob navigates to contacts and accepts — new tabbed layout starts on
  // "Friends", so switch to the "Requests" tab first.
  await pageB.goto('/contacts');
  await pageB.waitForLoadState('networkidle');
  await pageB.getByRole('button', { name: /Requests/ }).click();
  await expect(pageB.getByText(alice.username).first()).toBeVisible({ timeout: 10_000 });
  await pageB.getByRole('button', { name: 'Accept' }).first().click();

  // Alice refreshes contacts to see Bob in friends list (default tab), opens DM
  await pageA.goto('/contacts');
  await pageA.waitForLoadState('networkidle');
  await expect(pageA.getByRole('button', { name: 'Message' }).first()).toBeVisible({
    timeout: 10_000,
  });
  await pageA.getByRole('button', { name: 'Message' }).first().click();
  await pageA.waitForURL(new RegExp(`/dm/${bob.username}`), { timeout: 10_000 });

  // Wait for the DM surface (composer) to render — the dms list takes a moment to refresh
  await expect(pageA.getByPlaceholder('Type a message…')).toBeVisible({ timeout: 15_000 });

  // Alice sends a DM
  await pageA.getByPlaceholder('Type a message…').fill('hey bob via dm');
  await pageA.getByRole('button', { name: 'Send' }).click();

  // Bob navigates to the DM and should see the message
  await pageB.goto(`/dm/${alice.username}`);
  await pageB.waitForLoadState('networkidle');
  await expect(pageB.getByText('hey bob via dm').first()).toBeVisible({ timeout: 10_000 });

  // Bob replies — Alice sees it in real time on the already-open view
  await pageB.getByPlaceholder('Type a message…').fill('got it');
  await pageB.getByRole('button', { name: 'Send' }).click();
  await expect(pageA.getByText('got it').first()).toBeVisible({ timeout: 10_000 });

  await ctxA.close();
  await ctxB.close();
});
