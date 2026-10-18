import React from 'react';
import { describe, it, expect } from 'vitest';
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

  it('opens detailed inspection modal when clicking Inspect', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestimonialsPage />);

    await screen.findByText('Rahul Sharma');

    const inspectBtn = screen.getAllByRole('button', { name: /inspect/i })[0];
    await user.click(inspectBtn);

    // Modal opens with detailed metadata
    expect(await screen.findByRole('heading', { name: /testimonial from rahul sharma/i })).toBeInTheDocument();
    expect(screen.getByText(/verified consent/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 out of 5 stars/i)).toBeInTheDocument();
  });

  it('opens accessible delete confirmation modal and confirms deletion', async () => {
    let deletedId = '';
    server.use(
      http.delete('*/api/testimonials/:id', ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<TestimonialsPage />);

    await screen.findByText('Rahul Sharma');

    const deleteBtn = screen.getAllByTitle(/delete testimonial/i)[0];
    await user.click(deleteBtn);

    // Delete confirmation modal appears
    expect(await screen.findByRole('heading', { name: /permanently delete testimonial/i })).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: /confirm delete/i });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deletedId).toBeTruthy();
    });
  });

  it('submits bulk approval for selected testimonials', async () => {
    let bulkPayload: any = null;
    server.use(
      http.patch('*/api/testimonials/bulk-status', async ({ request }) => {
        bulkPayload = await request.json();
        return HttpResponse.json({ updated_count: bulkPayload.ids.length, status: bulkPayload.status });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<TestimonialsPage />);

    await screen.findByText('Rahul Sharma');

    // Select all on page
    const selectAllBtn = screen.getByRole('button', { name: /select all on page/i });
    await user.click(selectAllBtn);

    // Bulk action bar appears
    expect(await screen.findByText(/reviews selected/i)).toBeInTheDocument();

    const approveSelectedBtn = screen.getByRole('button', { name: /approve selected/i });
    await user.click(approveSelectedBtn);

    await waitFor(() => {
      expect(bulkPayload?.status).toBe('APPROVED');
      expect(bulkPayload?.ids.length).toBeGreaterThan(0);
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
          total_pages: 1,
          counts: { total: 0, pending: 0, approved: 0, rejected: 0, averageRating: 0 },
        });
      })
    );

    renderWithProviders(<TestimonialsPage />);

    expect(await screen.findByText(/no testimonials found/i)).toBeInTheDocument();
  });

  it('displays error banner and retry button on network failure', async () => {
    server.use(
      http.get('*/api/testimonials', () => {
        return HttpResponse.error();
      })
    );

    renderWithProviders(<TestimonialsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
