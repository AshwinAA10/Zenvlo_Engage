import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from './axios';
import { useAuthStore } from '../stores/authStore';
import { http, HttpResponse } from 'msw';
import { server } from '@test/mocks/server';

describe('Centralized Axios Client (apiClient)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      user: null,
      business: null,
      isAuthenticated: false,
    });
  });

  it('automatically attaches Bearer token header from authStore', async () => {
    useAuthStore.setState({
      token: 'test-bearer-token-123',
      isAuthenticated: true,
    });

    let interceptedAuthHeader: string | null = null;
    server.use(
      http.get('*/api/test-auth-header', ({ request }) => {
        interceptedAuthHeader = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      })
    );

    await apiClient.get('/test-auth-header');

    expect(interceptedAuthHeader).toBe('Bearer test-bearer-token-123');
  });

  it('triggers auto-logout in authStore upon 401 Unauthorized response', async () => {
    useAuthStore.setState({
      token: 'expired-token',
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@zenvlo.com' },
    });

    server.use(
      http.get('*/api/test-unauthorized', () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      })
    );

    await expect(apiClient.get('/test-unauthorized')).rejects.toThrow();

    // Verify authStore state was reset
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
