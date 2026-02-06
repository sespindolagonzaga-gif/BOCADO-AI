import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserProfile } from '../types';

interface UserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: (userId: string) => Promise<void>;
  setProfile: (profile: UserProfile) => void; // ✅ Agregado
  clearProfile: () => void;
  updateProfileField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void; // ✅ Tipado mejorado
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,
  
  fetchProfile: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        set({ 
          profile: { uid: userId, ...docSnap.data() } as UserProfile,
          isLoading: false 
        });
      } else {
        set({ error: 'Perfil no encontrado', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Error cargando perfil', isLoading: false });
    }
  },
  
  // ✅ NUEVO: Establecer perfil directamente (usado en login)
  setProfile: (profile) => set({ 
    profile, 
    isLoading: false, 
    error: null 
  }),
  
  // ✅ Mejorado: Tipado estricto para que value coincida con el tipo del campo
  updateProfileField: (field, value) => set((state) => ({
    profile: state.profile ? { ...state.profile, [field]: value } : null
  })),
  
  clearProfile: () => set({ profile: null, error: null }),
}));