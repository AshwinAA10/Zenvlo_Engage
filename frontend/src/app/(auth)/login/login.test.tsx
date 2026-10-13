import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from './page';

describe('LoginPage Integration Tests', () => {
  it('renders login form with all expected controls', () => {
    renderWithProviders(<LoginPage />);

    expect(
      screen.getByRole('heading', { name: /sign in to zenvlo engage/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('owner@business.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates required fields and email/password formats on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);

    // Validation messages from Zod loginSchema
    expect(
      await screen.findByText(/please provide a valid email address/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/password must be at least 6 characters/i)
    ).toBeInTheDocument();
  });

  it('submits valid credentials, updates authStore and displays success feedback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('owner@business.com');
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'owner@business.com');
    await user.type(passwordInput, 'validpassword123');
    await user.click(submitBtn);

    // Displays success message
    expect(
      await screen.findByText(/authenticated successfully! redirecting\.\.\./i)
    ).toBeInTheDocument();

    // Verifies authStore was updated with token and user
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-login-token-xyz');
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('owner@business.com');
      expect(state.business?.name).toBe('Zenvlo Wellness');
    });
  });

  it('renders API error banner on 401 invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('owner@business.com');
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'invalid@business.com');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitBtn);

    expect(
      await screen.findByText(/invalid email or password/i)
    ).toBeInTheDocument();
  });

  it('handles server network failure gracefully', async () => {
    server.use(
      http.post('*/api/auth/login', () => {
        return HttpResponse.error();
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('owner@business.com');
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'owner@business.com');
    await user.type(passwordInput, 'validpassword123');
    await user.click(submitBtn);

    expect(
      await screen.findByText(/authentication failed\. please check your credentials\./i)
    ).toBeInTheDocument();
  });
});
