import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  workspaces?: string[];
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  currentWorkspaceId: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserProfile, workspaceId?: string) => void;
  setWorkspace: (workspaceId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('zenvlo_engage_token') : null,
  user: null,
  currentWorkspaceId:
    typeof window !== 'undefined'
      ? localStorage.getItem('zenvlo_engage_workspace_id') || '00000000-0000-0000-0000-000000000000'
      : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('zenvlo_engage_token') : false,

  setAuth: (token: string, user: UserProfile, workspaceId?: string) => {
    const wsId = workspaceId || (user.workspaces && user.workspaces[0]) || '00000000-0000-0000-0000-000000000000';
    if (typeof window !== 'undefined') {
      localStorage.setItem('zenvlo_engage_token', token);
      localStorage.setItem('zenvlo_engage_workspace_id', wsId);
    }
    set({
      token,
      user,
      currentWorkspaceId: wsId,
      isAuthenticated: true,
    });
  },

  setWorkspace: (workspaceId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zenvlo_engage_workspace_id', workspaceId);
    }
    set({ currentWorkspaceId: workspaceId });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zenvlo_engage_token');
      localStorage.removeItem('zenvlo_engage_workspace_id');
    }
    set({
      token: null,
      user: null,
      currentWorkspaceId: null,
      isAuthenticated: false,
    });
  },
}));
