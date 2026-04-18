import { test, expect } from '@playwright/test';

test('register → create room → send message round-trip via UI', async ({ page }) => {
  const unique = Date.now();
  const email = `ui_${unique}@example.com`;
  const username = `ui${unique}`;
  const password = 'password123';
  const roomName = `uiroom${unique}`;


  // Register via UI
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[type=email]')).toBeVisible({ timeout: 10_000 });
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[autocomplete=username]').fill(username);
  await page.locator('input[autocomplete=new-password]').first().fill(password);
  await page.locator('input[autocomplete=new-password]').nth(1).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should land on /chat
  await expect(page).toHaveURL(/\/chat/, { timeout: 10_000 });

  // Create a room from the sidebar
  await page.getByRole('button', { name: /Create room/i }).click();
  const dialog = page.getByRole('dialog', { name: /Create room/i });
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().fill(roomName);
  await dialog.locator('input').nth(1).fill('ui smoke');
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  // Should redirect into the room
  await expect(page).toHaveURL(new RegExp(`/chat/${roomName}`), { timeout: 10_000 });
  await expect(page.getByText(`# ${roomName}`).first()).toBeVisible();

  // Send a message via the composer
  const composer = page.getByPlaceholder('Type a message…');
  await composer.fill('hello agora');
  await page.getByRole('button', { name: 'Send' }).click();

  // Message appears in the list
  await expect(page.getByText('hello agora').first()).toBeVisible({ timeout: 10_000 });
});
