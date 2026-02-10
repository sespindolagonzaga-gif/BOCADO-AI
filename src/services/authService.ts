import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FormData, UserProfile } from '../types';
import { separateUserData } from '../utils/profileSanitizer';

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

  await setDoc(doc(db, 'users', uid), userProfile);

  return { uid };
};