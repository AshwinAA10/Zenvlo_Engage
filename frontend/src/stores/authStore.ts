import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  category: string;
  logo_url?: string | null;
  phone?: string | null;
  website?: string | null;
  location?: string | null;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  business: BusinessProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserProfile, business?: BusinessProfile | null) => void;
  setBusiness: (business: BusinessProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('zenvlo_engage_token') : null,
  user: null,
  business: null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('zenvlo_engage_token') : false,

  setAuth: (token: string, user: UserProfile, business?: BusinessProfile | null) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zenvlo_engage_token', token);
      if (business) {
        localStorage.setItem('zenvlo_engage_business', JSON.stringify(business));
      }
    }
    set({
      token,
      user,
      business: business || null,
      isAuthenticated: true,
    });
  },

  setBusiness: (business: BusinessProfile) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zenvlo_engage_business', JSON.stringify(business));
    }
    set({ business });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zenvlo_engage_token');
      localStorage.removeItem('zenvlo_engage_business');
    }
    set({
      token: null,
      user: null,
      business: null,
      isAuthenticated: false,
    });
  },
}));
