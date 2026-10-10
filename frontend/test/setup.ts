import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../src/stores/authStore';
import { server } from './mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

// Polyfill window.matchMedia for theme-provider and responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill ResizeObserver for embed widgets & responsive components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// Mock window.alert and window.confirm to avoid uncaught JSDOM errors
window.alert = vi.fn();
window.confirm = vi.fn(() => true);
window.scrollTo = vi.fn();

// Mock next/navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    token: null,
    user: null,
    business: null,
    isAuthenticated: false,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
