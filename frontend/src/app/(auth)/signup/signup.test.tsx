import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import { useAuthStore } from '@/stores/authStore';
import SignupPage from './page';

describe('SignupPage Integration Tests', () => {
  it('renders signup form and controls', () => {
    renderWithProviders(<SignupPage />);

    expect(
      screen.getByRole('heading', { name: /start collecting reviews with zenvlo engage/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Lotus Wellness Clinic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Aarav')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Sharma')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('owner@business.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create free account/i })
    ).toBeInTheDocument();
  });

  it('validates required fields on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    const submitBtn = screen.getByRole('button', { name: /create free account/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/business name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/please enter a valid email address/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/password must be at least 6 characters/i)
    ).toBeInTheDocument();
  });

  it('submits valid registration and populates auth store', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByPlaceholderText('e.g. Lotus Wellness Clinic'), 'Lotus Wellness');
    await user.type(screen.getByPlaceholderText('Aarav'), 'Aarav');
    await user.type(screen.getByPlaceholderText('owner@business.com'), 'newowner@business.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'secret123');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(
      await screen.findByText(/account created successfully! initializing workspace\.\.\./i)
    ).toBeInTheDocument();

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-signup-token-xyz');
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('newowner@business.com');
      expect(state.business?.name).toBe('Lotus Wellness');
    });
  });

  it('displays API error banner when email is already registered (409 conflict)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByPlaceholderText('e.g. Lotus Wellness Clinic'), 'Lotus Wellness');
    await user.type(screen.getByPlaceholderText('Aarav'), 'Aarav');
    await user.type(screen.getByPlaceholderText('owner@business.com'), 'conflict@business.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'secret123');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(
      await screen.findByText(/a user with this email address already exists/i)
    ).toBeInTheDocument();
  });

  it('handles server network failure gracefully', async () => {
    server.use(
      http.post('*/api/auth/signup', () => {
        return HttpResponse.error();
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByPlaceholderText('e.g. Lotus Wellness Clinic'), 'Lotus Wellness');
    await user.type(screen.getByPlaceholderText('Aarav'), 'Aarav');
    await user.type(screen.getByPlaceholderText('owner@business.com'), 'user@business.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'secret123');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(
      await screen.findByText(/registration failed\. please check your information and try again\./i)
    ).toBeInTheDocument();
  });
});
