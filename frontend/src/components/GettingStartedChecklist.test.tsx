import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import { GettingStartedChecklist, ChecklistStatus } from './GettingStartedChecklist';

const mockChecklistData: ChecklistStatus = {
  business_id: 'bus-test-123',
  total_tasks: 5,
  completed_tasks: 2,
  progress_percentage: 40,
  all_completed: false,
  dismissed: false,
  collapsed: false,
  tasks: [
    {
      id: 'profile',
      title: 'Complete Business Profile',
      description: 'Set up your business name, category, website, and branding for testimonial requests.',
      action_url: '/settings',
      action_label: 'Open Settings',
      completed: true,
      is_optional: false,
      status_hint: 'Business profile configured',
    },
    {
      id: 'customer',
      title: 'Add Your First Customer',
      description: 'Add a customer or import a contact list to start sending automated feedback requests.',
      action_url: '/customers',
      action_label: 'Add Customer',
      completed: true,
      is_optional: false,
      status_hint: '3 customers added',
    },
    {
      id: 'request',
      title: 'Send Testimonial Request',
      description: 'Send a personalized WhatsApp or direct review invite to a customer.',
      action_url: '/requests',
      action_label: 'Send Request',
      completed: false,
      is_optional: false,
      status_hint: 'Ready to dispatch invites',
    },
    {
      id: 'testimonial',
      title: 'Receive Your First Testimonial',
      description: 'Collect your first customer rating and review via WhatsApp or public link.',
      action_url: '/testimonials',
      action_label: 'View Testimonials',
      completed: false,
      is_optional: false,
      status_hint: 'Awaiting customer submissions',
    },
    {
      id: 'widget',
      title: 'Create & Embed a Widget',
      description: 'Showcase approved testimonials on your website using an embeddable badge or wall.',
      action_url: '/widgets',
      action_label: 'Configure Widget',
      completed: false,
      is_optional: true,
      status_hint: 'Embed social proof on your site',
    },
  ],
};

describe('GettingStartedChecklist Component', () => {
  it('renders all 5 checklist tasks and displays accurate progress', async () => {
    server.use(
      http.get('*/api/business/checklist', () => {
        return HttpResponse.json(mockChecklistData);
      })
    );

    renderWithProviders(<GettingStartedChecklist />);

    expect(
      await screen.findByRole('heading', { name: /getting started checklist/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/2 of 5 completed \(40%\)/i)).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');

    // Verify task titles
    expect(screen.getByText('Complete Business Profile')).toBeInTheDocument();
    expect(screen.getByText('Add Your First Customer')).toBeInTheDocument();
    expect(screen.getByText('Send Testimonial Request')).toBeInTheDocument();
    expect(screen.getByText('Receive Your First Testimonial')).toBeInTheDocument();
    expect(screen.getByText('Create & Embed a Widget')).toBeInTheDocument();

    // Verify actionable CTA buttons for incomplete tasks
    expect(screen.getByRole('button', { name: /send request/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view testimonials/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /configure widget/i })).toBeInTheDocument();
  });

  it('collapses and expands the task list on toggle button click', async () => {
    server.use(
      http.get('*/api/business/checklist', () => {
        return HttpResponse.json(mockChecklistData);
      }),
      http.patch('*/api/business/checklist-preferences', async ({ request }) => {
        const body = (await request.json()) as any;
        return HttpResponse.json({
          ...mockChecklistData,
          collapsed: body.collapsed,
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<GettingStartedChecklist />);

    expect(await screen.findByText('Complete Business Profile')).toBeInTheDocument();

    // Click collapse toggle
    const collapseBtn = screen.getByRole('button', { name: /collapse checklist/i });
    await user.click(collapseBtn);

    // After collapsing, task list is hidden
    await waitFor(() => {
      expect(screen.queryByText('Complete Business Profile')).not.toBeInTheDocument();
    });

    // Expand button should now be visible
    const expandBtn = screen.getByRole('button', { name: /expand checklist/i });
    expect(expandBtn).toBeInTheDocument();
    await user.click(expandBtn);

    // Task list is restored
    expect(await screen.findByText('Complete Business Profile')).toBeInTheDocument();
  });

  it('dismisses checklist to a minimized recovery pill without losing completion progress', async () => {
    let capturedPreferences: any = null;

    server.use(
      http.get('*/api/business/checklist', () => {
        return HttpResponse.json(mockChecklistData);
      }),
      http.patch('*/api/business/checklist-preferences', async ({ request }) => {
        capturedPreferences = await request.json();
        return HttpResponse.json({
          ...mockChecklistData,
          dismissed: capturedPreferences.dismissed,
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<GettingStartedChecklist />);

    expect(await screen.findByText('Getting Started Checklist')).toBeInTheDocument();

    // Click dismiss button
    const dismissBtn = screen.getByRole('button', { name: /dismiss checklist/i });
    await user.click(dismissBtn);

    // Verifies preference was patched
    await waitFor(() => {
      expect(capturedPreferences).toEqual({ dismissed: true });
    });

    // Minimized recovery pill is now visible with accurate progress
    expect(
      await screen.findByRole('region', { name: /getting started checklist minimized/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/2\/5 completed \(40%\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show checklist/i })).toBeInTheDocument();

    // Task items are hidden but completion is intact
    expect(screen.queryByText('Complete Business Profile')).not.toBeInTheDocument();

    // Reopen checklist
    const showBtn = screen.getByRole('button', { name: /show checklist/i });
    await user.click(showBtn);

    // Full checklist card restored
    expect(await screen.findByText('Complete Business Profile')).toBeInTheDocument();
  });

  it('renders celebratory banner when all tasks are completed', async () => {
    const allCompletedData: ChecklistStatus = {
      ...mockChecklistData,
      completed_tasks: 5,
      progress_percentage: 100,
      all_completed: true,
      tasks: mockChecklistData.tasks.map((t) => ({ ...t, completed: true })),
    };

    server.use(
      http.get('*/api/business/checklist', () => {
        return HttpResponse.json(allCompletedData);
      })
    );

    renderWithProviders(<GettingStartedChecklist />);

    expect(
      await screen.findByText(/all essential onboarding milestones completed/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/fully setup/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
