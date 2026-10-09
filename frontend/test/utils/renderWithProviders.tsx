import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, UserProfile, BusinessProfile } from '@/stores/authStore';

export interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialAuthState?: {
    token?: string | null;
    user?: UserProfile | null;
    business?: BusinessProfile | null;
    isAuthenticated?: boolean;
  };
  queryClient?: QueryClient;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const {
    initialAuthState,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  if (initialAuthState) {
    useAuthStore.setState({
      token: initialAuthState.token ?? null,
      user: initialAuthState.user ?? null,
      business: initialAuthState.business ?? null,
      isAuthenticated: initialAuthState.isAuthenticated ?? !!initialAuthState.token,
    });
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
  };
}

export * from '@testing-library/react';
