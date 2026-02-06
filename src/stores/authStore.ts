import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userEmail: string | null;
  userUid: string | null;
  
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      userEmail: null,
      userUid: null,
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false,
        userEmail: user?.email || null,
        userUid: user?.uid || null,
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      logout: () => set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false,
        userEmail: null,
        userUid: null,
      }),
    }),
    {
      name: 'bocado-auth',
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        userEmail: state.userEmail,
        userUid: state.userUid,
      }),
    }
  )
);