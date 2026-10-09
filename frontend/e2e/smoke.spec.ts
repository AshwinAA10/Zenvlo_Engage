import { test, expect } from '@playwright/test';

test.describe('Frontend Application Smoke Tests', () => {
  test('home page starts and renders landing hero content', async ({ page }) => {
    await page.goto('/');

    // Verify main landing heading
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText('Turn WhatsApp Feedback into Website Social Proof');

    // Verify navigation buttons exist
    await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /start free/i })).toBeVisible();
  });

  test('login route renders authentication form with accessible elements', async ({ page }) => {
    await page.goto('/login');

    // Verify authentication heading
    await expect(
      page.getByRole('heading', { name: /sign in to zenvlo engage/i })
    ).toBeVisible();

    // Verify interactive form controls
    await expect(page.getByPlaceholder('owner@business.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
