import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import PublicTestimonialPage from './page';

// Mock useParams to return the verified business slug
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ slug: 'zenvlo-wellness' }),
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

describe('PublicTestimonialPage Integration Tests', () => {
  it('loads business profile and renders public feedback form', async () => {
    renderWithProviders(<PublicTestimonialPage />);

    // Business info header
    expect(await screen.findByRole('heading', { name: 'Zenvlo Wellness' })).toBeInTheDocument();
    expect(screen.getByText('Salon & Spa')).toBeInTheDocument();

    // Feedback inputs
    expect(screen.getByText(/share your experience/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Tell us what you liked most about your experience...')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Ananya Roy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('validates minimum review content and reviewer name length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicTestimonialPage />);

    await screen.findByRole('heading', { name: 'Zenvlo Wellness' });

    // Submit without typing review content or reviewer name
    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/please provide at least 5 characters of feedback/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/please enter your name/i)
    ).toBeInTheDocument();
  });

  it('submits valid review with star rating and displays success screen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicTestimonialPage />);

    await screen.findByRole('heading', { name: 'Zenvlo Wellness' });

    // Click 5 Star button
    const fiveStarBtn = screen.getByTitle('5 Star');
    await user.click(fiveStarBtn);

    const contentInput = screen.getByPlaceholderText('Tell us what you liked most about your experience...');
    await user.type(contentInput, 'The treatment was outstanding and the therapists were very polite!');

    const nameInput = screen.getByPlaceholderText('e.g. Ananya Roy');
    await user.type(nameInput, 'Ananya Roy');

    const phoneInput = screen.getByPlaceholderText('+91 98765 43210');
    await user.type(phoneInput, '+919988776655');

    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    await user.click(submitBtn);

    // Confirmation screen rendered
    expect(
      await screen.findByRole('heading', { name: /thank you for your feedback!/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your review is being processed and will be featured on their website soon\./i)
    ).toBeInTheDocument();
  });

  it('displays not found screen when business slug does not exist (404)', async () => {
    server.use(
      http.get('*/api/testimonials/public/:slug/info', () => {
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      })
    );

    renderWithProviders(<PublicTestimonialPage />);

    expect(await screen.findByText(/business not found/i)).toBeInTheDocument();
    expect(
      screen.getByText(/the testimonial form you are looking for does not exist or has been disabled\./i)
    ).toBeInTheDocument();
  });
});
