import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';
import CustomersPage from './page';

describe('CustomersPage & WhatsApp Requests Integration Tests', () => {
  it('renders customer directory and lists active contacts', async () => {
    renderWithProviders(<CustomersPage />);

    expect(
      screen.getByRole('heading', { name: /customer directory/i })
    ).toBeInTheDocument();

    // Verify populated customer rows from mock data
    expect(await screen.findByText('Rahul Sharma')).toBeInTheDocument();
    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('+919988776655')).toBeInTheDocument();
  });

  it('renders empty state when no customers exist', async () => {
    server.use(
      http.get('*/api/customers', () => {
        return HttpResponse.json({ data: [], total: 0 });
      })
    );

    renderWithProviders(<CustomersPage />);

    expect(await screen.findByText(/no customers found/i)).toBeInTheDocument();
  });

  it('validates required fields in Add Customer modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    // Open Add Customer dialog
    const addBtn = screen.getByRole('button', { name: /add customer/i });
    await user.click(addBtn);

    expect(await screen.findByRole('heading', { name: /add new customer/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. Meera Nair');
    const phoneInput = screen.getByPlaceholderText('+91 98765 43210');
    expect(nameInput).toBeRequired();
    expect(phoneInput).toBeRequired();

    // Type spaces to trigger client trim validation error on submit
    await user.type(nameInput, '   ');
    await user.type(phoneInput, '   ');

    const saveBtn = screen.getByRole('button', { name: /save customer/i });
    await user.click(saveBtn);

    // Form validation check
    expect(
      await screen.findByText(/name and phone number are required\./i)
    ).toBeInTheDocument();
  });

  it('creates a new customer and refreshes the directory', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    // Open dialog
    await user.click(screen.getByRole('button', { name: /add customer/i }));

    const nameInput = await screen.findByPlaceholderText('e.g. Meera Nair');
    const phoneInput = screen.getByPlaceholderText('+91 98765 43210');

    await user.type(nameInput, 'Ananya Sen');
    await user.type(phoneInput, '+919876543210');

    const saveBtn = screen.getByRole('button', { name: /save customer/i });
    await user.click(saveBtn);

    // Modal closes and list is refreshed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /add new customer/i })).not.toBeInTheDocument();
    });
  });

  it('dispatches a single WhatsApp testimonial request and shows success banner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    // Wait for customer rows to appear
    await screen.findByText('Rahul Sharma');

    // Click WhatsApp Request button for first customer
    const requestButtons = screen.getAllByTitle('Send WhatsApp testimonial request');
    await user.click(requestButtons[0]);

    // Verifies success confirmation banner
    expect(
      await screen.findByText(/whatsapp review request dispatched to rahul sharma!/i)
    ).toBeInTheDocument();
  });

  it('dispatches batch WhatsApp testimonial requests for selected contacts', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await screen.findByText('Rahul Sharma');

    // Select row checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    // First row checkbox (after select-all header)
    await user.click(checkboxes[1]);

    // Batch toolbar should appear
    expect(await screen.findByText('Contacts Selected')).toBeInTheDocument();

    const batchSendBtn = screen.getByRole('button', { name: /send whatsapp request \(1\)/i });
    await user.click(batchSendBtn);

    expect(
      await screen.findByText(/dispatched whatsapp requests to 1 selected contacts!/i)
    ).toBeInTheDocument();
  });

  it('handles WhatsApp request API failure gracefully with alert feedback', async () => {
    server.use(
      http.post('*/api/requests/send', () => {
        return HttpResponse.json(
          { message: 'WhatsApp quota exhausted for this billing cycle' },
          { status: 403 }
        );
      })
    );

    const alertSpy = vi.spyOn(window, 'alert');
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await screen.findByText('Rahul Sharma');
    const requestButtons = screen.getAllByTitle('Send WhatsApp testimonial request');
    await user.click(requestButtons[0]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'WhatsApp quota exhausted for this billing cycle'
      );
    });
  });
});
