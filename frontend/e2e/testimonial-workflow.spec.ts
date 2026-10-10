import { test, expect } from '@playwright/test';

test.describe('Zenvlo CRM End-to-End Testimonial & Social Proof Workflow', () => {
  test('completes full end-to-end testimonial workflow: signup -> add customer -> send WhatsApp request -> public submission -> business approval -> widget creation -> public widget display', async ({
    page,
    browser,
  }) => {
    const timestamp = Date.now();
    const ownerEmail = `dr_rhea_${timestamp}@zenvlo-test.com`;
    const businessName = `Rhea Aesthetics Clinic ${timestamp}`;
    const password = 'StrongPassword123!';
    const customerName = `Aarav Sharma ${timestamp.toString().slice(-4)}`;
    const customerPhone = '+919876543210';
    const reviewContent =
      'Outstanding dermatological care and warm hospitality! Truly transformed my skincare routine.';

    // =========================================================================
    // STEP 1: Register business account and initialize tenant context
    // =========================================================================
    await page.goto('/signup');
    await expect(
      page.getByRole('heading', { name: /start collecting reviews with zenvlo engage/i })
    ).toBeVisible();

    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(businessName);
    await page.getByPlaceholder('Aarav').fill('Rhea');
    await page.getByPlaceholder('Sharma').fill('Sen');
    await page.getByPlaceholder('owner@business.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);

    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Retrieve generated business slug from localStorage
    const businessData = await page.evaluate(() => {
      const stored = localStorage.getItem('zenvlo_engage_business');
      return stored ? JSON.parse(stored) : null;
    });
    expect(businessData).not.toBeNull();
    const businessSlug = businessData.slug;
    expect(businessSlug).toBeTruthy();

    // =========================================================================
    // STEP 2: Add customer in customer management directory
    // =========================================================================
    await page.getByRole('link', { name: 'Customers', exact: true }).click();
    await expect(page).toHaveURL(/\/customers/);
    await expect(
      page.getByRole('heading', { name: /customer directory/i })
    ).toBeVisible();

    // Open Add Customer dialog
    const addCustomerBtn = page.getByRole('button', { name: /add customer/i });
    await addCustomerBtn.click();

    await expect(
      page.getByRole('heading', { name: /add new customer/i })
    ).toBeVisible();

    await page.getByPlaceholder('e.g. Meera Nair').fill(customerName);
    await page.getByPlaceholder('+91 98765 43210').fill(customerPhone);
    await page.getByPlaceholder('meera@example.com').fill(`customer_${timestamp}@example.com`);

    await page.getByRole('button', { name: /save customer/i }).click();

    // Verify modal closes and customer row appears in directory table
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(customerPhone)).toBeVisible();

    // =========================================================================
    // STEP 3: Dispatch simulated WhatsApp testimonial request
    // =========================================================================
    // Click WhatsApp Request button on customer row
    const sendRequestBtn = page.getByTitle('Send WhatsApp testimonial request');
    await expect(sendRequestBtn).toBeVisible();
    await sendRequestBtn.click();

    // Verify feedback confirmation banner
    await expect(
      page.getByText(new RegExp(`whatsapp review request dispatched to ${customerName}`, 'i'))
    ).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 4: Submit public testimonial in separate unauthenticated context
    // =========================================================================
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    // Open public submission form with business slug
    await publicPage.goto(`/submit/${businessSlug}`);
    await expect(
      publicPage.getByRole('heading', { name: businessName, exact: true })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      publicPage.getByText(/share your experience/i)
    ).toBeVisible();

    // Fill in 5-star review form
    await publicPage.getByTitle('5 Star').click();
    await publicPage
      .getByPlaceholder('Tell us what you liked most about your experience...')
      .fill(reviewContent);
    await publicPage.getByPlaceholder('e.g. Ananya Roy').fill(customerName);
    await publicPage.getByPlaceholder('+91 98765 43210').fill(customerPhone);

    const submitReviewBtn = publicPage.getByRole('button', { name: /submit review/i });
    await submitReviewBtn.click();

    // Verify success confirmation screen
    await expect(
      publicPage.getByRole('heading', { name: /thank you for your feedback!/i })
    ).toBeVisible({ timeout: 10000 });

    await publicContext.close();

    // =========================================================================
    // STEP 5: Business Dashboard: Moderate and approve testimonial
    // =========================================================================
    await page.getByRole('link', { name: 'Testimonials', exact: true }).click();
    await expect(page).toHaveURL(/\/testimonials/);
    await expect(
      page.getByRole('heading', { name: /testimonial moderation/i })
    ).toBeVisible();

    // Verify review appears with PENDING status
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(reviewContent)).toBeVisible();
    await expect(page.getByText('PENDING', { exact: true })).toBeVisible();

    // Click Approve button
    const approveBtn = page.getByRole('button', { name: /^approve$/i });
    await approveBtn.click();

    // Verify status transitions to APPROVED
    await expect(page.getByText('APPROVED', { exact: true })).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STEP 6: Create and configure embeddable website widget
    // =========================================================================
    await page.getByRole('link', { name: 'Widgets', exact: true }).click();
    await expect(page).toHaveURL(/\/widgets/);
    await expect(
      page.getByRole('heading', { name: /website widgets/i })
    ).toBeVisible();

    // Open Create New Widget modal
    await page.getByRole('button', { name: /create new widget/i }).click();
    await expect(
      page.getByRole('heading', { name: /create new widget/i })
    ).toBeVisible();

    // Set widget name
    const widgetName = `Wall of Love ${timestamp}`;
    const nameInput = page.getByPlaceholder('e.g. Landing Page Wall of Love');
    await nameInput.clear();
    await nameInput.fill(widgetName);

    // Save widget
    await page.getByRole('button', { name: /save & generate code/i }).click();

    // Verify modal closes and widget card renders
    await expect(page.getByText(widgetName)).toBeVisible({ timeout: 10000 });

    // Open Get Embed Code dialog to extract the standalone widget URL
    await page.getByRole('button', { name: /get embed code/i }).first().click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`embed [“"']?${widgetName}[”"']?`, 'i') })
    ).toBeVisible();

    // Click "Direct Link" tab
    await page.getByRole('button', { name: 'Direct Link' }).click();

    // Read URL from preformatted code box
    const directLinkPre = page.locator('pre');
    const directLinkText = await directLinkPre.innerText();
    expect(directLinkText).toContain('/embed/');
    const widgetEmbedPath = directLinkText.trim().replace(/^https?:\/\/[^/]+/, '');

    // Close embed modal
    await page.keyboard.press('Escape');

    // =========================================================================
    // STEP 7: Verify public widget displays approved testimonial
    // =========================================================================
    const widgetVisitorContext = await browser.newContext();
    const widgetVisitorPage = await widgetVisitorContext.newPage();

    await widgetVisitorPage.goto(widgetEmbedPath);

    // Verify widget container loads with business name
    await expect(
      widgetVisitorPage.getByText(new RegExp(`customer reviews for ${businessName}`, 'i'))
    ).toBeVisible({ timeout: 15000 });

    // Verify the approved customer testimonial is rendered
    await expect(widgetVisitorPage.getByText(customerName)).toBeVisible();
    await expect(widgetVisitorPage.getByText(reviewContent)).toBeVisible();
    await expect(widgetVisitorPage.getByText('Verified Review', { exact: true })).toBeVisible();

    // STRICT PRIVACY VERIFICATION: Ensure private contact phone is never leaked to public visitors
    const pageHtml = await widgetVisitorPage.content();
    expect(pageHtml).not.toContain(customerPhone);
    expect(pageHtml).not.toContain(ownerEmail);

    await widgetVisitorContext.close();
  });

  test('unapproved / pending testimonials are strictly excluded from the public widget', async ({
    page,
    browser,
  }) => {
    const timestamp = Date.now();
    const ownerEmail = `moderation_owner_${timestamp}@zenvlo-test.com`;
    const businessName = `Moderation Test Clinic ${timestamp}`;
    const password = 'StrongPassword123!';
    const customerName = `Pending Reviewer ${timestamp.toString().slice(-4)}`;
    const pendingContent =
      'This review is brand new and has not been approved by the clinic owner yet.';

    // 1. Sign up business
    await page.goto('/signup');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(businessName);
    await page.getByPlaceholder('Aarav').fill('Dr');
    await page.getByPlaceholder('Sharma').fill('Kiran');
    await page.getByPlaceholder('owner@business.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    const businessData = await page.evaluate(() => {
      const stored = localStorage.getItem('zenvlo_engage_business');
      return stored ? JSON.parse(stored) : null;
    });
    const businessSlug = businessData.slug;

    // 2. Create widget
    const widgetName = `Wall of Love Moderation ${timestamp}`;
    await page.getByRole('link', { name: 'Widgets', exact: true }).click();
    await page.getByRole('button', { name: /create new widget/i }).click();
    await page.getByPlaceholder('e.g. Landing Page Wall of Love').fill(widgetName);
    await page.getByRole('button', { name: /save & generate code/i }).click();
    await expect(page.getByText(widgetName)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /get embed code/i }).first().click();
    await page.getByRole('button', { name: 'Direct Link' }).click();
    const directLinkText = await page.locator('pre').innerText();
    const widgetEmbedPath = directLinkText.trim().replace(/^https?:\/\/[^/]+/, '');
    await page.keyboard.press('Escape');

    // 3. Submit a review via public form
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/submit/${businessSlug}`);
    await publicPage.getByTitle('5 Star').click();
    await publicPage
      .getByPlaceholder('Tell us what you liked most about your experience...')
      .fill(pendingContent);
    await publicPage.getByPlaceholder('e.g. Ananya Roy').fill(customerName);
    await publicPage.getByRole('button', { name: /submit review/i }).click();
    await expect(
      publicPage.getByRole('heading', { name: /thank you for your feedback!/i })
    ).toBeVisible({ timeout: 10000 });
    await publicContext.close();

    // 4. Leave review in PENDING state (do NOT approve)
    // 5. Open public widget in unauthenticated visitor session
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(widgetEmbedPath);

    // Verify empty state is displayed because review is still pending
    await expect(visitorPage.getByText(/no reviews found/i)).toBeVisible({ timeout: 15000 });
    await expect(visitorPage.getByText(pendingContent)).not.toBeVisible();
    await expect(visitorPage.getByText(customerName)).not.toBeVisible();

    await visitorContext.close();
  });

  test('displays graceful error state when public submission slug is invalid or non-existent', async ({
    page,
  }) => {
    await page.goto('/submit/non-existent-clinic-slug-xyz');
    await expect(page.getByRole('heading', { name: /business not found/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText(/the testimonial form you are looking for does not exist or has been disabled/i)
    ).toBeVisible();
  });

  test('public submission form enforces input validation', async ({ page }) => {
    const timestamp = Date.now();
    const ownerEmail = `val_owner_${timestamp}@zenvlo-test.com`;
    const businessName = `Validation Clinic ${timestamp}`;
    const password = 'StrongPassword123!';

    // Register a business to get a valid submission form
    await page.goto('/signup');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(businessName);
    await page.getByPlaceholder('Aarav').fill('Dr');
    await page.getByPlaceholder('Sharma').fill('Val');
    await page.getByPlaceholder('owner@business.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    const businessData = await page.evaluate(() => {
      const stored = localStorage.getItem('zenvlo_engage_business');
      return stored ? JSON.parse(stored) : null;
    });
    const businessSlug = businessData.slug;

    // Navigate to public submission page
    await page.goto(`/submit/${businessSlug}`);
    await expect(page.getByRole('heading', { name: businessName, exact: true })).toBeVisible({
      timeout: 15000,
    });

    const submitBtn = page.getByRole('button', { name: /submit review/i });
    await submitBtn.click();

    // Verify validation errors
    await expect(
      page.getByText(/please provide at least 5 characters of feedback/i)
    ).toBeVisible();
    await expect(page.getByText(/please enter your name/i)).toBeVisible();
  });

  test('public widget displays graceful empty state when business has no approved reviews', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const ownerEmail = `empty_owner_${timestamp}@zenvlo-test.com`;
    const businessName = `Fresh Business ${timestamp}`;
    const password = 'StrongPassword123!';

    // Register
    await page.goto('/signup');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(businessName);
    await page.getByPlaceholder('Aarav').fill('Owner');
    await page.getByPlaceholder('owner@business.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••••••').fill(password);
    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Create widget
    const widgetName = `Wall of Love Empty ${timestamp}`;
    await page.getByRole('link', { name: 'Widgets', exact: true }).click();
    await page.getByRole('button', { name: /create new widget/i }).click();
    await page.getByPlaceholder('e.g. Landing Page Wall of Love').fill(widgetName);
    await page.getByRole('button', { name: /save & generate code/i }).click();
    await expect(page.getByText(widgetName)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /get embed code/i }).first().click();
    await page.getByRole('button', { name: 'Direct Link' }).click();
    const directLinkText = await page.locator('pre').innerText();
    const widgetEmbedPath = directLinkText.trim().replace(/^https?:\/\/[^/]+/, '');

    // Visit public embed page
    await page.goto(widgetEmbedPath);
    await expect(page.getByText(/no reviews found/i)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/approved reviews will show up here automatically/i)
    ).toBeVisible();
  });

  test('tenant isolation: prevents cross-business WhatsApp request dispatch for unauthorized customer', async ({
    page,
    request,
  }) => {
    const timestamp = Date.now();
    // Register Business A
    await page.goto('/signup');
    await page.getByPlaceholder('e.g. Lotus Wellness Clinic').fill(`Clinic A ${timestamp}`);
    await page.getByPlaceholder('Aarav').fill('Doctor');
    await page.getByPlaceholder('Sharma').fill('Alpha');
    await page.getByPlaceholder('owner@business.com').fill(`alpha_${timestamp}@zenvlo-test.com`);
    await page.getByPlaceholder('••••••••••••').fill('StrongPassword123!');
    await page.getByRole('button', { name: /create free account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    const token = await page.evaluate(() => localStorage.getItem('zenvlo_engage_token'));
    expect(token).toBeTruthy();

    // Attempt to dispatch request with a foreign/non-existent customer UUID
    const randomForeignCustomerId = '00000000-0000-0000-0000-000000000000';
    const response = await request.post('http://localhost:4001/api/requests/send', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        customer_id: randomForeignCustomerId,
      },
    });

    // Should return 404 (Customer not found or does not belong to your business)
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.message).toMatch(/customer not found/i);
  });
});
