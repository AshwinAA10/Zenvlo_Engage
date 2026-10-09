import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@test/utils/renderWithProviders';
import LoginPage from './page';

describe('LoginPage Smoke Test', () => {
  it('renders the login form and its accessible elements', () => {
    renderWithProviders(<LoginPage />);

    // Accessible heading check
    expect(
      screen.getByRole('heading', { name: /sign in to zenvlo engage/i })
    ).toBeInTheDocument();

    // Form inputs and submit button checks via accessible roles & labels
    expect(screen.getByPlaceholderText('owner@business.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });
});
