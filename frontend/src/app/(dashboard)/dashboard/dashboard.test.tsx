import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import DashboardOverviewPage from './page';

describe('DashboardOverviewPage Integration Tests', () => {
  it('renders dashboard with verified KPI cards, pending moderation alerts, and activity feeds', async () => {
    renderWithProviders(<DashboardOverviewPage />);

    expect(
      screen.getByRole('heading', { name: /dashboard/i })
    ).toBeInTheDocument();

    // Verify KPI card titles and values loaded from MSW handlers
    expect(await screen.findByText('Total Testimonials')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Delivery')).toBeInTheDocument();
    expect(screen.getByText('Response Conversion')).toBeInTheDocument();

    // Verify pending approvals banner appears because mockTestimonials has 1 PENDING item
    expect(
      await screen.findByText(/1 Testimonial Requires Moderation/i)
    ).toBeInTheDocument();

    // Verify recent testimonials and request dispatches feeds are rendered
    expect(screen.getByText('Recent Testimonials')).toBeInTheDocument();
    expect(screen.getByText('Recent Request Dispatches')).toBeInTheDocument();

    // Testimonial authors
    const authorMatches = await screen.findAllByText('Rahul Sharma');
    expect(authorMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('navigates directly to moderation when clicking Review & Moderate', async () => {
    renderWithProviders(<DashboardOverviewPage />);

    const reviewBtn = await screen.findByRole('button', {
      name: /review & moderate/i,
    });
    expect(reviewBtn).toBeInTheDocument();
    expect(reviewBtn.closest('a')).toHaveAttribute(
      'href',
      '/testimonials?status=PENDING'
    );
  });

  it('renders 14-day WhatsApp activity trend chart', async () => {
    renderWithProviders(<DashboardOverviewPage />);

    expect(
      await screen.findByText(/14-Day WhatsApp Activity Trend/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Requests Initiated')).toBeInTheDocument();
    expect(screen.getByText('Confirmed Delivered')).toBeInTheDocument();
  });

  it('handles empty state for brand new accounts with encouraging guidance', async () => {
    // Override mocks with 0 testimonials and 0 requests
    server.use(
      http.get('*/api/testimonials', () => {
        return HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          counts: { total: 0, pending: 0, approved: 0, rejected: 0, averageRating: 0 },
        });
      }),
      http.get('*/api/requests/analytics', () => {
        return HttpResponse.json({
          period: { startDate: '', endDate: '', prevStartDate: '', prevEndDate: '', days: 14 },
          summary: {
            total_requests: 0,
            confirmed_delivered: 0,
            confirmed_read: 0,
            confirmed_failed: 0,
            pending_confirmation: 0,
            feedback_responses: 0,
            delivery_success_rate: null,
            overall_delivery_rate: 0,
            response_rate_delivered: null,
            response_rate_total: 0,
          },
          comparison: {
            prev_total_requests: 0,
            prev_confirmed_delivered: 0,
            prev_feedback_responses: 0,
            total_requests_change_pct: null,
            delivered_change_pct: null,
            responses_change_pct: null,
          },
          delivery_breakdown: [],
          trend: [],
          meta: { channel: 'WHATSAPP', unknown_outcomes_count: 0, semantics: {} },
        });
      }),
      http.get('*/api/requests', () => {
        return HttpResponse.json({ data: [], total: 0, page: 1, limit: 5 });
      })
    );

    renderWithProviders(<DashboardOverviewPage />);

    // Verify empty state messages in feeds
    expect(await screen.findByText(/No Testimonials Received Yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No WhatsApp Requests Dispatched/i)).toBeInTheDocument();

    // Verify rating displays N/A instead of false 5.0
    const naBadges = screen.getAllByText('N/A');
    expect(naBadges.length).toBeGreaterThanOrEqual(1);
  });

  it(
    'opens Quick Send modal and sends a WhatsApp request from dashboard',
    async () => {
      let sentPayload: any = null;
      server.use(
        http.post('*/api/requests/send', async ({ request }) => {
          sentPayload = await request.json();
          return HttpResponse.json({
            id: 'req-quick-1',
            customer_name: sentPayload.customer_name,
            customer_phone: sentPayload.customer_phone,
            delivery_status: 'QUEUED',
          });
        })
      );

      const user = userEvent.setup({ delay: null });
      renderWithProviders(<DashboardOverviewPage />);

      // Click "Send WhatsApp Request" in header
      const sendBtn = await screen.findByRole('button', {
        name: /^send whatsapp request$/i,
      });
      await user.click(sendBtn);

      // Dialog opens
      expect(
        screen.getByRole('dialog', { name: /send whatsapp review request/i })
      ).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText(/rahul sharma/i);
      const phoneInput = screen.getByPlaceholderText(/\+91 98765 43210/i);

      await user.type(nameInput, 'Amit Verma');
      await user.type(phoneInput, '+919876500000');

      // Submit dialog
      const dispatchBtn = screen.getByRole('button', {
        name: /^dispatch via whatsapp$/i,
      });
      await user.click(dispatchBtn);

      await waitFor(() => {
        expect(sentPayload).toEqual({
          customer_name: 'Amit Verma',
          customer_phone: '+919876500000',
        });
      });

      expect(
        await screen.findByText(/review request sent successfully/i)
      ).toBeInTheDocument();
    },
    15000
  );

  it('handles partial API failures gracefully without crashing other sections', async () => {
    // Simulate analytics endpoint failure
    server.use(
      http.get('*/api/requests/analytics', () => {
        return HttpResponse.json(
          { message: 'Analytics calculation timeout' },
          { status: 504 }
        );
      })
    );

    renderWithProviders(<DashboardOverviewPage />);

    // Non-blocking error notification appears
    expect(
      await screen.findByText(/unable to refresh request analytics/i)
    ).toBeInTheDocument();

    // Yet testimonials and other components render successfully!
    expect(screen.getByText('Total Testimonials')).toBeInTheDocument();
    expect(screen.getByText('Recent Testimonials')).toBeInTheDocument();
    const authorMatches = await screen.findAllByText('Rahul Sharma');
    expect(authorMatches.length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
