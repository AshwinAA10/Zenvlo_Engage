import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import TestimonialsPage from './page';

describe('TestimonialsPage Moderation Integration Tests', () => {
  it('renders moderation dashboard with metric counts and testimonial cards', async () => {
    renderWithProviders(<TestimonialsPage />);

    expect(
      screen.getByRole('heading', { name: /testimonial moderation/i })
    ).toBeInTheDocument();

    // Verify reviews loaded from mock server
    expect(await screen.findByText('Rahul Sharma')).toBeInTheDocument();
    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();
    expect(
      screen.getByText(/incredible experience! the team at zenvlo was professional and courteous\./i)
    ).toBeInTheDocument();

    // Check status badges
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('triggers approval when clicking the Approve button', async () => {
    let patchedStatus = '';
    server.use(
      http.patch('*/api/testimonials/:id/status', async ({ request }) => {
        const body = (await request.json()) as any;
        patchedStatus = body.status;
        return HttpResponse.json({ success: true, status: patchedStatus });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<TestimonialsPage />);

    await screen.findByText('Rahul Sharma');

    // Click Approve on the pending testimonial (action button in card)
    const approveBtn = screen.getByRole('button', { name: /^approve$/i });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(patchedStatus).toBe('APPROVED');
    });
  });

  it('opens rejection modal, allows selecting reason, and submits rejection', async () => {
    let rejectionPayload: any = null;
    server.use(
      http.patch('*/api/testimonials/:id/status', async ({ request }) => {
        rejectionPayload = await request.json();
        return HttpResponse.json({ success: true, ...rejectionPayload });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<TestimonialsPage />);

    await screen.findByText('Rahul Sharma');

    // Click Reject button on pending testimonial card
    const rejectBtn = screen.getAllByRole('button', { name: /^reject$/i })[0];
    await user.click(rejectBtn);

    // Verify Rejection modal opens
    expect(await screen.findByRole('heading', { name: /reject testimonial/i })).toBeInTheDocument();

    // Click preset reason
    const spamBtn = screen.getByRole('button', { name: /spam or promo/i });
    await user.click(spamBtn);

    // Confirm rejection
    const confirmBtn = screen.getByRole('button', { name: /confirm rejection/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(rejectionPayload?.status).toBe('REJECTED');
      expect(rejectionPayload?.rejection_reason).toBe('Spam or Promo');
    });
  });

  it('renders empty state when no testimonials match tab filter', async () => {
    server.use(
      http.get('*/api/testimonials', () => {
        return HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          counts: { total: 0, pending: 0, approved: 0, rejected: 0, averageRating: 0 },
        });
      })
    );

    renderWithProviders(<TestimonialsPage />);

    expect(await screen.findByText(/no testimonials found/i)).toBeInTheDocument();
  });
});
