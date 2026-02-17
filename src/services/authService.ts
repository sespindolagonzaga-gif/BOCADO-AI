import { auth, db } from '../firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { FormData, UserProfile } from '../types';
import { separateUserData } from '../utils/profileSanitizer';

// Helper para convertir undefined a null antes de guardar en Firestore
const cleanForFirestore = (obj: Record<string, any>): Record<string, any> => {
  const cleanValue = (value: any): any => {
    if (value === undefined) return null;
    if (value === null) return null;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const cleanedObj: Record<string, any> = {};
      Object.keys(value).forEach(k => {
        cleanedObj[k] = cleanValue(value[k]);
      });
      return cleanedObj;
    }
    return value;
  };

  const cleaned: Record<string, any> = { ...obj };
  Object.keys(cleaned).forEach(key => {
    cleaned[key] = cleanValue(cleaned[key]);
  });
  return cleaned;
};

export const registerUser = async (formData: FormData): Promise<{ uid: string }> => {
  const { auth: authData, profile } = separateUserData(formData);
  
  // 1. Crear usuario en Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(
    auth, 
    authData.email, 
    authData.password!
  );
  
  const user = userCredential.user;
  const uid = user.uid;

  // 2. Actualizar displayName en Auth
  const displayName = `${authData.firstName} ${authData.lastName}`;
  await updateProfile(user, { displayName });

  // 3. Guardar SOLO datos de perfil en Firestore (SIN email, SIN nombres)
  const userProfile: UserProfile = {
    uid,
    ...profile,
    createdAt: serverTimestamp() as UserProfile['createdAt'],
    updatedAt: serverTimestamp() as UserProfile['updatedAt'],
  };

  await setDoc(doc(db, 'users', uid), cleanForFirestore(userProfile));

  return { uid };
};

/**
 * Inicia sesión con Google
 * Si es un usuario nuevo, retorna isNewUser: true para que complete el perfil
 */
export const signInWithGoogle = async (): Promise<{ 
  uid: string; 
  isNewUser: boolean; 
  email: string | null;
}> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;
  
  // Verificar si el usuario ya tiene perfil en Firestore
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const isNewUser = !userDoc.exists();
  
  // Si es usuario nuevo, crear un perfil básico (se completará después)
  if (isNewUser) {
    const basicProfile: Partial<UserProfile> = {
      uid: user.uid,
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp() as UserProfile['createdAt'],
      updatedAt: serverTimestamp() as UserProfile['updatedAt'],
    };
    
    await setDoc(doc(db, 'users', user.uid), cleanForFirestore(basicProfile));
  }
  
  return { 
    uid: user.uid, 
    isNewUser,
    email: user.email 
  };
};