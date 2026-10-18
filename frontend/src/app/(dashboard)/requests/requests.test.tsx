import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import RequestsPage from './page';

describe('RequestsPage & Request Analytics Integration Tests', () => {
  it('renders analytics dashboard with verified KPI cards, delivery rate, and trend chart', async () => {
    renderWithProviders(<RequestsPage />);

    expect(
      screen.getByRole('heading', { name: /whatsapp requests & analytics/i })
    ).toBeInTheDocument();

    // Verify KPI card titles and loaded values from mock analytics
    expect(await screen.findByText('Total Requests Created')).toBeInTheDocument();
    expect(screen.getByText('Delivery Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Read Engagement Rate')).toBeInTheDocument();
    expect(screen.getByText('Feedback Response Rate')).toBeInTheDocument();

    // Check specific values computed from known outcomes: 90% delivery success
    expect(await screen.findByText('90%')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // total requests

    // Verify trend chart component loaded
    expect(screen.getByText(/request activity & delivery trends/i)).toBeInTheDocument();
  });

  it('allows toggling between Chart view and accessible Table view', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestsPage />);

    await screen.findByText(/request activity & delivery trends/i);

    // Click Table View toggle
    const tableToggleBtn = screen.getByRole('button', { name: /^table view$/i });
    await user.click(tableToggleBtn);

    // Verify table headers appear
    expect(screen.getByRole('columnheader', { name: /^date$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^dispatched$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^delivered$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^reviews$/i })).toBeInTheDocument();

    // Verify specific dates from mock
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();
    expect(screen.getByText('2026-10-02')).toBeInTheDocument();
  });

  it('switches period presets to request updated analytics window', async () => {
    let capturedStartDate = '';
    server.use(
      http.get('*/api/requests/analytics', ({ request }) => {
        const url = new URL(request.url);
        capturedStartDate = url.searchParams.get('startDate') || '';
        return HttpResponse.json({
          period: {
            startDate: capturedStartDate,
            endDate: new Date().toISOString(),
            prevStartDate: '',
            prevEndDate: '',
            days: 7,
          },
          summary: {
            total_requests: 5,
            confirmed_delivered: 4,
            confirmed_read: 2,
            confirmed_failed: 0,
            pending_confirmation: 1,
            feedback_responses: 2,
            delivery_success_rate: 100,
            overall_delivery_rate: 80,
            response_rate_delivered: 50,
            response_rate_total: 40,
          },
          comparison: {
            prev_total_requests: 3,
            prev_confirmed_delivered: 2,
            prev_feedback_responses: 1,
            total_requests_change_pct: 66.7,
            delivered_change_pct: 100,
            responses_change_pct: 100,
          },
          delivery_breakdown: [],
          trend: [],
          meta: { channel: 'WHATSAPP', unknown_outcomes_count: 1, semantics: {} },
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<RequestsPage />);

    const sevenDaysBtn = await screen.findByRole('button', { name: /^7 days$/i });
    await user.click(sevenDaysBtn);

    await waitFor(() => {
      expect(capturedStartDate).toBeTruthy();
    });
  });

  it('switches to Dispatches & History tab and displays log records', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestsPage />);

    const dispatchesTab = await screen.findByRole('button', { name: /dispatches & history/i });
    await user.click(dispatchesTab);

    // Verify recipient details and loaded records from mockRequestLogs
    expect(await screen.findByText('+919988776655')).toBeInTheDocument();
    expect(screen.getByText('+919988776644')).toBeInTheDocument();
    expect(screen.getByText('Review Submitted')).toBeInTheDocument();
  });

  it('deep links from KPI card to Dispatches tab with filter applied', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestsPage />);

    // Click "View Failed" link on the Confirmed Failures KPI card
    const viewFailedBtn = await screen.findByRole('button', { name: /view failed/i });
    await user.click(viewFailedBtn);

    // Expect tab switched to dispatches and Failed filter active
    expect(await screen.findByText('+919988776644')).toBeInTheDocument(); // Priya Patel (failed request)
    const failedTab = screen.getByRole('button', { name: /^failed$/i });
    expect(failedTab).toBeInTheDocument();
  });

  it('displays honest N/A metric when 0 terminal outcomes are recorded in cohort', async () => {
    server.use(
      http.get('*/api/requests/analytics', () => {
        return HttpResponse.json({
          period: {
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-10-02T00:00:00.000Z',
            prevStartDate: '',
            prevEndDate: '',
            days: 1,
          },
          summary: {
            total_requests: 2,
            confirmed_delivered: 0,
            confirmed_read: 0,
            confirmed_failed: 0,
            pending_confirmation: 2,
            feedback_responses: 0,
            delivery_success_rate: null, // Zero terminal outcomes
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
          meta: { channel: 'WHATSAPP', unknown_outcomes_count: 2, semantics: {} },
        });
      })
    );

    renderWithProviders(<RequestsPage />);

    // Must show N/A for delivery success rate and response rate rather than fabricated 0% or 100%
    const naBadges = await screen.findAllByText('N/A');
    expect(naBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders network error banner and recovers on retry', async () => {
    let failFirstTime = true;
    server.use(
      http.get('*/api/requests/analytics', () => {
        if (failFirstTime) {
          failFirstTime = false;
          return HttpResponse.json(
            { message: 'Analytics service temporarily unavailable' },
            { status: 503 }
          );
        }
        return HttpResponse.json({
          period: { startDate: '', endDate: '', prevStartDate: '', prevEndDate: '', days: 30 },
          summary: {
            total_requests: 10,
            confirmed_delivered: 8,
            confirmed_read: 5,
            confirmed_failed: 1,
            pending_confirmation: 1,
            feedback_responses: 3,
            delivery_success_rate: 88.9,
            overall_delivery_rate: 80,
            response_rate_delivered: 37.5,
            response_rate_total: 30,
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
          meta: { channel: 'WHATSAPP', unknown_outcomes_count: 1, semantics: {} },
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<RequestsPage />);

    // Expect error message and Retry button
    expect(
      await screen.findByText(/analytics service temporarily unavailable/i)
    ).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry request/i });

    // Click retry
    await user.click(retryBtn);

    // Recovers successfully
    expect(await screen.findByText('Total Requests Created')).toBeInTheDocument();
    expect(screen.queryByText(/analytics service temporarily unavailable/i)).not.toBeInTheDocument();
  });
});
