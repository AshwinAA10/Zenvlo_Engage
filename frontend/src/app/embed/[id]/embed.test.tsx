import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import StandaloneEmbedPage from './page';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ id: 'widget-1' }),
  };
});

describe('StandaloneEmbedPage Public Widget Rendering Integration Tests', () => {
  it('fetches and renders approved social proof testimonials in the public widget', async () => {
    renderWithProviders(<StandaloneEmbedPage />);

    // Renders approved testimonial item
    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();
    expect(
      screen.getByText(/best service in town! highly recommend their spa packages\./i)
    ).toBeInTheDocument();

    // Verifies strict exclusion: pending review from Rahul Sharma must NOT appear
    expect(screen.queryByText('Rahul Sharma')).not.toBeInTheDocument();
  });

  it('displays error state when widget is inactive or not found (404)', async () => {
    server.use(
      http.get('*/api/widgets/public/:id', () => {
        return HttpResponse.json(
          { message: 'Widget not found or inactive' },
          { status: 404 }
        );
      })
    );

    renderWithProviders(<StandaloneEmbedPage />);

    expect(
      await screen.findByText(/widget not found or inactive/i)
    ).toBeInTheDocument();
  });
});
