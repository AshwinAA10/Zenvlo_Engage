import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import WidgetsPage from './page';

describe('WidgetsPage Integration Tests', () => {
  it('renders widget management dashboard with existing widgets', async () => {
    renderWithProviders(<WidgetsPage />);

    expect(
      screen.getByRole('heading', { name: /website widgets/i })
    ).toBeInTheDocument();

    // Verify existing widget from mock data
    expect(await screen.findByText('Wall of Love')).toBeInTheDocument();
    expect(screen.getByText('WALL')).toBeInTheDocument();
  });

  it('opens widget creation modal and configures new widget', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WidgetsPage />);

    // Click Create New Widget button
    const createBtn = screen.getByRole('button', { name: /create new widget/i });
    await user.click(createBtn);

    expect(
      await screen.findByRole('heading', { name: /create new widget/i })
    ).toBeInTheDocument();

    // Form controls check
    const nameInput = screen.getByPlaceholderText('e.g. Landing Page Wall of Love');
    expect(nameInput).toHaveValue('Wall of Love');

    // Change widget name
    await user.clear(nameInput);
    await user.type(nameInput, 'Homepage Carousel');

    // Select Carousel layout style
    const carouselOption = screen.getByText('Carousel Slider');
    await user.click(carouselOption);

    // Save widget
    const saveBtn = screen.getByRole('button', { name: /save & generate code/i });
    await user.click(saveBtn);

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create new widget/i })).not.toBeInTheDocument();
    });
  });

  it('renders empty state when no widgets exist', async () => {
    server.use(
      http.get('*/api/widgets', () => {
        return HttpResponse.json([]);
      })
    );

    renderWithProviders(<WidgetsPage />);

    expect(
      await screen.findByText(/no widgets created yet/i)
    ).toBeInTheDocument();
  });
});
