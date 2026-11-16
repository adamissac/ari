import { expect, test } from '@playwright/test';
import { newUser } from './helpers';

// These tests intercept the network on purpose: they prove the UI shows honest
// failure states instead of substituting data when the backend misbehaves.

test('backend unreachable is an explicit error, never fake content', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.abort('connectionrefused'));
  await page.goto('/projects');
  await expect(page.getByTestId('error-state')).toContainText('Backend unreachable');
  await expect(page.getByTestId('error-state')).toContainText('Nothing shown here is cached or simulated');
  await expect(page.getByText('Your projects')).toHaveCount(0);
});

test('a response that violates the shared contract is rejected, not rendered', async ({ page }) => {
  await page.route('**/api/v1/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'not-an-id' }, memberships: [], csrf_token: 'x' }) }));
  await page.goto('/projects');
  await expect(page.getByTestId('error-state')).toContainText('Backend response rejected');
});

test('the home page is public: a signed-out visitor sees it, not a sign-in form', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
});

test('a signed-in visitor still sees who they are on the home page', async ({ browser }) => {
  const page = await newUser(browser, 'e2e-alice');
  await page.goto('/');
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveText('e2e-alice');
});

test('the home page stays up even when the backend is down', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.abort('connectionrefused'));
  await page.goto('/');
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.getByTestId('error-state')).toHaveCount(0);
});

test('signed-out users see sign-in, not data', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toHaveAttribute('href', '/api/v1/auth/github/login');
  // A sign-in screen shows no records, so the records footer must not claim it does (#288).
  await expect(page.getByTestId('site-footer')).toHaveCount(0);
  await page.goto('/access');
  await expect(page.getByTestId('access-signin')).toBeVisible();
  await expect(page.getByTestId('site-footer')).toHaveCount(0);
});

test('a malformed bundle name is refused by the server', async ({ request }) => {
  const res = await request.get('/lab/bundles/..%2F..%2Fetc');
  expect([400, 404]).toContain(res.status());
});
