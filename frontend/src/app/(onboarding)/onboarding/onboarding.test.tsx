import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import { useAuthStore } from '@/stores/authStore';
import OnboardingPage from './page';

describe('OnboardingPage Integration Tests', () => {
  it('renders onboarding form with preset category buttons and fields', () => {
    renderWithProviders(<OnboardingPage />);

    expect(
      screen.getByRole('heading', { name: /configure your business profile/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Aura Aesthetics & Laser Clinic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salon & spa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /healthcare & clinic/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /complete setup & enter dashboard/i })
    ).toBeInTheDocument();
  });

  it('validates business name minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />);

    // Clear default category or leave it, clear name and type a 1-character name
    const nameInput = screen.getByPlaceholderText('e.g. Aura Aesthetics & Laser Clinic');
    await user.clear(nameInput);
    await user.type(nameInput, 'A');

    const submitBtn = screen.getByRole('button', { name: /complete setup & enter dashboard/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/business name must be at least 2 characters/i)
    ).toBeInTheDocument();
  });

  it('allows category selection via presets and updates the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />);

    const clinicBtn = screen.getByRole('button', { name: /healthcare & clinic/i });
    await user.click(clinicBtn);

    const categoryInput = screen.getByPlaceholderText('Or enter custom category');
    expect(categoryInput).toHaveValue('Healthcare & Clinic');
  });

  it('submits onboarding successfully, updates business in authStore and shows confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />);

    const nameInput = screen.getByPlaceholderText('e.g. Aura Aesthetics & Laser Clinic');
    await user.clear(nameInput);
    await user.type(nameInput, 'Aura Aesthetics');

    const clinicBtn = screen.getByRole('button', { name: /healthcare & clinic/i });
    await user.click(clinicBtn);

    const phoneInput = screen.getByPlaceholderText('+91 98765 43210');
    await user.type(phoneInput, '+91 98765 43210');

    const submitBtn = screen.getByRole('button', { name: /complete setup & enter dashboard/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/business profile configured! launching your engage console\.\.\./i)
    ).toBeInTheDocument();

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.business?.name).toBe('Aura Aesthetics');
      expect(state.business?.category).toBe('Healthcare & Clinic');
    });
  });

  it('displays API error banner when onboarding fails on backend', async () => {
    server.use(
      http.post('*/api/business/onboarding', () => {
        return HttpResponse.json(
          { message: 'Business slug already in use' },
          { status: 400 }
        );
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />);

    const nameInput = screen.getByPlaceholderText('e.g. Aura Aesthetics & Laser Clinic');
    await user.clear(nameInput);
    await user.type(nameInput, 'Aura Aesthetics');

    const submitBtn = screen.getByRole('button', { name: /complete setup & enter dashboard/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/business slug already in use/i)
    ).toBeInTheDocument();
  });
});
