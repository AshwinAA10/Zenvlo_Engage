import { test, expect } from '@playwright/test';

test.describe('Zenvlo CRM Signup and Authentication E2E', () => {
  test('completes successful business owner signup and navigates to dashboard with tenant context', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const uniqueEmail = `owner_e2e_${timestamp}@zenvlo-test.com`;
    const businessName = `Zenvlo Wellness Spa ${timestamp}`;
    const password = 'StrongPassword123!';

    // 1. Navigate to actual signup page
    await page.goto('/signup');
    await expect(
      page.getByRole('heading', { name: /start collecting reviews with zenvlo engage/i })
    ).toBeVisible();

    // 2. Fill in valid signup fields
    await page.getByPlaceholder('Aarav').fill('Ananya');
    await page.getByPlaceholder('Sharma').fill('Roy');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(businessName);
    await page.getByPlaceholder('owner@business.com').fill(uniqueEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);

    // 3. Submit signup form
    const submitBtn = page.getByRole('button', { name: /create free account/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Verify successful authentication & redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // 5. Verify that tenant business context is properly initialized and rendered in sidebar
    await expect(page.getByText(businessName, { exact: true })).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();

    // 6. Verify dashboard shell navigation is fully functional
    await expect(page.getByRole('link', { name: 'Customers', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Testimonials', exact: true })).toBeVisible();
  });

  test('enforces client-side validation for missing and invalid signup fields', async ({ page }) => {
    await page.goto('/signup');

    // Attempt submitting completely empty form
    const submitBtn = page.getByRole('button', { name: /create free account/i });
    await submitBtn.click();

    // Verify all field validation error feedback
    await expect(page.getByText(/first name is required/i)).toBeVisible();
    await expect(page.getByText(/business name must be at least 2 characters/i)).toBeVisible();
    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible();
    await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();

    // Enter invalid format values
    await page.getByPlaceholder('owner@business.com').fill('not-an-email');
    await page.getByPlaceholder('••••••••••••').fill('123');
    await submitBtn.click();

    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible();
    await expect(page.getByText(/password must be at least 6 characters/i)).toBeVisible();

    // Ensure user remains on signup page and no unintended account is created
    await expect(page).toHaveURL(/\/signup/);
  });

  test('handles server conflict error (409) when attempting duplicate email registration', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const existingEmail = `duplicate_e2e_${timestamp}@zenvlo-test.com`;
    const password = 'StrongPassword123!';

    // First, register the account successfully
    await page.goto('/signup');
    await page.getByPlaceholder('Aarav').fill('First');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill('First Business');
    await page.getByPlaceholder('owner@business.com').fill(existingEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Log out back to auth state
    const signOutBtn = page.getByTitle('Sign out');
    await signOutBtn.click();
    await expect(page).toHaveURL(/\/login/);

    // Attempt registering again with the exact same email
    await page.goto('/signup');
    await page.getByPlaceholder('Aarav').fill('Second');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill('Second Business');
    await page.getByPlaceholder('owner@business.com').fill(existingEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);

    const submitBtn = page.getByRole('button', { name: /create free account/i });
    await submitBtn.click();

    // Verify error banner feedback
    await expect(
      page.getByText(/an account with this email address already exists|registration failed/i)
    ).toBeVisible();

    // Verify loading indicator resolves and form remains on signup
    await expect(submitBtn).toBeEnabled();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('authenticates existing business owner via login and restores session', async ({ page }) => {
    const timestamp = Date.now();
    const email = `login_e2e_${timestamp}@zenvlo-test.com`;
    const businessName = `Login Test Business ${timestamp}`;
    const password = 'StrongPassword123!';

    // Register user
    await page.goto('/signup');
    await page.getByPlaceholder('Aarav').fill('Test');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(businessName);
    await page.getByPlaceholder('owner@business.com').fill(email);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Sign out
    await page.getByTitle('Sign out').click();
    await expect(page).toHaveURL(/\/login/);

    // Sign back in on login page
    await page.getByPlaceholder('owner@business.com').fill(email);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify success redirect and business profile recovery
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(businessName, { exact: true })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('handles invalid credentials on login gracefully (401 error path)', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('owner@business.com').fill('nonexistent_user@zenvlo-test.com');
    await page.getByPlaceholder('••••••••••••').fill('WrongPassword999!');

    const submitBtn = page.getByRole('button', { name: /sign in/i });
    await submitBtn.click();

    // Verify error alert banner
    await expect(
      page.getByText(/invalid email or password|invalid credentials|authentication failed/i)
    ).toBeVisible();

    // Verify button is re-enabled and route remains /login
    await expect(submitBtn).toBeEnabled();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Zenvlo CRM Business Onboarding Flow E2E', () => {
  test('guides user without existing business to complete onboarding and launch dashboard', async ({
    page,
    request,
  }) => {
    const timestamp = Date.now();
    const email = `onboarding_e2e_${timestamp}@zenvlo-test.com`;
    const password = 'StrongPassword123!';
    const businessName = `Apex Dental Clinic ${timestamp}`;

    // 1. Create a user via backend API without business_name (simulating user needing onboarding)
    const signupRes = await request.post('http://localhost:4001/api/auth/signup', {
      data: {
        email,
        password,
        first_name: 'Anita',
        last_name: 'Desai',
      },
    });
    expect(signupRes.ok()).toBeTruthy();
    const signupData = await signupRes.json();
    expect(signupData.business).toBeNull();

    // 2. User logs in via the UI
    await page.goto('/login');
    await page.getByPlaceholder('owner@business.com').fill(email);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // 3. User without business is automatically directed to /onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });

    // 4. Verify onboarding page elements
    await expect(
      page.getByRole('heading', { name: /configure your business profile/i })
    ).toBeVisible();

    // 5. Fill out onboarding form
    await page.getByPlaceholder('e.g. Aura Aesthetics & Laser Clinic').fill(businessName);

    // Select category preset
    const healthcareBtn = page.getByRole('button', { name: 'Healthcare & Clinic' });
    await healthcareBtn.click();

    await page.getByPlaceholder('+91 98765 43210').fill('+91 98765 43210');
    await page.getByPlaceholder('https://auraclinic.in').fill('https://apexdental.example.com');
    await page.getByPlaceholder('Indiranagar, Bengaluru, Karnataka').fill('Indiranagar, Bengaluru');

    // 6. Submit onboarding
    const launchBtn = page.getByRole('button', {
      name: /complete setup & enter dashboard/i,
    });
    await launchBtn.click();

    // 7. Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // 8. Verify the newly configured business name and category are displayed
    await expect(page.getByText(businessName, { exact: true })).toBeVisible();
    await expect(page.getByText('Healthcare & Clinic')).toBeVisible();
  });

  test('validates required business name during onboarding', async ({ page, request }) => {
    const timestamp = Date.now();
    const email = `onboarding_val_${timestamp}@zenvlo-test.com`;
    const password = 'StrongPassword123!';

    // Register user without business
    const signupRes = await request.post('http://localhost:4001/api/auth/signup', {
      data: {
        email,
        password,
        first_name: 'Rohit',
      },
    });
    expect(signupRes.ok()).toBeTruthy();

    // Log in
    await page.goto('/login');
    await page.getByPlaceholder('owner@business.com').fill(email);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });

    // Clear business name and submit
    const nameInput = page.getByPlaceholder('e.g. Aura Aesthetics & Laser Clinic');
    await nameInput.fill('');

    const launchBtn = page.getByRole('button', {
      name: /complete setup & enter dashboard/i,
    });
    await launchBtn.click();

    // Verify validation message
    await expect(
      page.getByText(/business name must be at least 2 characters/i)
    ).toBeVisible();

    // Verify remains on onboarding
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
