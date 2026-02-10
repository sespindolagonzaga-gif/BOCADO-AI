import React, { useState, useEffect } from 'react';
import { FormData, UserProfile } from '../types';
import { UserIcon } from './icons/UserIcon';
import { LockIcon } from './icons/LockIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ExclamationIcon } from './icons/ExclamationIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { BellIcon } from './icons/BellIcon';
import Step1 from './form-steps/Step1';
import Step2 from './form-steps/Step2';
import Step3 from './form-steps/Step3';
import NotificationSettings from './NotificationSettings';
import { db, auth, trackEvent } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp, deleteDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updateEmail, 
  sendEmailVerification, 
  updateProfile,
  deleteUser
} from 'firebase/auth';
import { sanitizeProfileData, separateUserData, safeLog } from '../utils/profileSanitizer';
import { useUserProfile, useUpdateUserProfile } from '../hooks/useUser';
import { useAuthStore } from '../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '../environment/env';

interface ProfileScreenProps {
  onLogout?: () => void;
  onProfileUpdate: (newFirstName: string) => void;
  userUid: string;
}

const stripEmoji = (str: string) => {
    if (!str) return str;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    const parts = str.split(' ');
    if (parts.length > 0 && emojiRegex.test(parts[0])) {
        return parts.slice(1).join(' ');
    }
    return str;
};

const buildFormData = (user: any, profile: UserProfile | null | undefined): FormData => {
  const nameParts = user?.displayName?.split(' ') || ['', ''];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return {
    firstName,
    lastName,
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    gender: profile?.gender || '',
    age: profile?.age || '',
    weight: profile?.weight || '',
    height: profile?.height || '',
    country: profile?.country || '',
    city: profile?.city || '',
    diseases: profile?.diseases || [],
    allergies: profile?.allergies || [],
    otherAllergies: profile?.otherAllergies || '',
    eatingHabit: profile?.eatingHabit || '',
    activityLevel: profile?.activityLevel || '',
    otherActivityLevel: profile?.otherActivityLevel || '',
    activityFrequency: profile?.activityFrequency || '',
    nutritionalGoal: profile?.nutritionalGoal || [],
    cookingAffinity: profile?.cookingAffinity || '',
    dislikedFoods: profile?.dislikedFoods || [],
  } as FormData;
};

const InfoSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
        <h3 className="text-2xs font-bold text-bocado-gray uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex flex-wrap gap-2">{children}</div>
    </div>
);

const Badge: React.FC<{ text: string; color: 'green' | 'blue' | 'red' | 'gray' | 'yellow'; title?: string }> = ({ text, color, title }) => {
    const colors = {
        green: 'bg-green-100 text-green-700',
        blue: 'bg-blue-100 text-blue-700',
        red: 'bg-red-100 text-red-700',
        gray: 'bg-bocado-background text-bocado-dark-gray',
        yellow: 'bg-yellow-100 text-yellow-700',
    };
    return <span title={title} className={`px-2.5 py-1 text-xs font-medium rounded-full ${colors[color]}`}>{text}</span>;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, onProfileUpdate, userUid }) => {
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'changePassword' | 'changeEmail' | 'exportData' | 'deleteAccount'>('view');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  const { user } = useAuthStore();
  const { data: profile } = useUserProfile(userUid);
  const updateProfileMutation = useUpdateUserProfile();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<FormData>(() => buildFormData(user, profile));
  const [initialFormData, setInitialFormData] = useState<FormData>(() => buildFormData(user, profile));
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  // Estados para eliminación de cuenta
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportedData, setExportedData] = useState<any>(null);
  
  const [cityOptions, setCityOptions] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // ✅ ANALÍTICA: Trackeo de entrada a la pantalla
  useEffect(() => {
    trackEvent('profile_screen_view', { userId: userUid });
  }, [userUid]);

  useEffect(() => {
    const data = buildFormData(user, profile);
    setFormData(data);
    setInitialFormData(data);
  }, [user, profile]);

  // Debounce hook para búsqueda de ciudades
  const useDebounce = (value: string, delay: number = 500) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  const [cityQuery, setCityQuery] = useState('');
  const debouncedCityQuery = useDebounce(cityQuery, 500);

  useEffect(() => {
    if (debouncedCityQuery.trim().length >= 3) {
      fetchCities(debouncedCityQuery);
    } else {
      setCityOptions([]);
    }
  }, [debouncedCityQuery]);

  const fetchCities = async (query: string) => {
    setIsSearchingCity(true);
    try {
        const countryCode = (formData.country || 'MX').toUpperCase(); 
        const username = env.api.geonamesUsername; 
        const res = await fetch(
            `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(query)}&country=${countryCode}&maxRows=10&username=${username}&lang=es`
        );
        const data = await res.json();
        setCityOptions(data.geonames || []);
    } catch (error) {
        safeLog('error', "Error buscando ciudades", error);
    } finally {
        setIsSearchingCity(false);
    }
  };

  // Wrapper para mantener compatibilidad con el componente existente
  const handleCitySearch = (query: string) => {
    setCityQuery(query);
  };

  const handleSaveProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !userUid) {
        setError("No se pudo verificar la sesión.");
        return;
    }

    setError('');

    try {
      const { auth: authData, profile: profileData } = separateUserData(formData);
      
      const newDisplayName = `${authData.firstName} ${authData.lastName}`;
      if (currentUser.displayName !== newDisplayName) {
        await updateProfile(currentUser, { displayName: newDisplayName });
        useAuthStore.getState().setUser({ ...currentUser, displayName: newDisplayName });
      }

      const userProfile: UserProfile = {
        uid: userUid,
        gender: profileData.gender,
        age: profileData.age,
        weight: profileData.weight,
        height: profileData.height,
        country: profileData.country.toUpperCase(),
        city: profileData.city,
        diseases: profileData.diseases,
        allergies: profileData.allergies,
        otherAllergies: profileData.otherAllergies,
        eatingHabit: profileData.eatingHabit,
        activityLevel: profileData.activityLevel,
        otherActivityLevel: profileData.otherActivityLevel,
        activityFrequency: profileData.activityFrequency,
        nutritionalGoal: profileData.nutritionalGoal,
        cookingAffinity: profileData.cookingAffinity,
        dislikedFoods: profileData.dislikedFoods,
        updatedAt: serverTimestamp() as UserProfile['updatedAt'],
      };

      await updateProfileMutation.mutateAsync({ userId: userUid, data: userProfile });
      queryClient.setQueryData(['userProfile', userUid], userProfile);
      
      // ✅ ANALÍTICA: Perfil actualizado correctamente
      trackEvent('profile_update_success', {
        goals: userProfile.nutritionalGoal.join(','),
        has_allergies: userProfile.allergies.length > 0
      });

      setInitialFormData(formData);
      setViewMode('view');
      setSuccessMessage('¡Perfil actualizado!');
      onProfileUpdate(authData.firstName);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      safeLog('error', "Error updating profile:", err);
      // ✅ ANALÍTICA: Error en actualización
      trackEvent('profile_update_error');
      setError("No se pudieron guardar los cambios.");
    }
  };

  const updateData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        setError('Todos los campos son obligatorios.');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        setError('Las contraseñas no coinciden.');
        return;
    }
    if (newPassword.length < 8) {
        setError('Mínimo 8 caracteres.');
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        setError('Sesión expirada. Vuelve a iniciar sesión.');
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        // ✅ ANALÍTICA: Password cambiado
        trackEvent('profile_security_password_changed');

        setSuccessMessage('¡Contraseña actualizada!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setViewMode('view'), 2000);
    } catch (err: any) {
        trackEvent('profile_security_password_error', { code: err.code });
        if (err.code === 'auth/wrong-password') setError('Contraseña actual incorrecta.');
        else setError('Error al actualizar.');
    }
  };
  
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!emailPassword || !newEmail) {
        setError('Todos los campos son obligatorios.');
        return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        setError('Sesión expirada.');
        return;
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    if (currentUser.email.toLowerCase() === normalizedNewEmail) {
        setError('El correo es igual al actual.');
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, emailPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updateEmail(currentUser, normalizedNewEmail);
        
        // ✅ ANALÍTICA: Email cambiado
        trackEvent('profile_security_email_changed');

        const updatedFormData = { ...formData, email: normalizedNewEmail };
        setFormData(updatedFormData);
        
        await sendEmailVerification(currentUser);
        setSuccessMessage('¡Correo actualizado! Verifica tu email.');
        
        setEmailPassword('');
        setNewEmail('');
        setTimeout(() => setViewMode('view'), 4000);
    } catch (err: any) {
        trackEvent('profile_security_email_error', { code: err.code });
        if (err.code === 'auth/wrong-password') setError('Contraseña incorrecta.');
        else if (err.code === 'auth/email-already-in-use') setError('Correo en uso.');
        else setError('Error al actualizar.');
    }
  };

  // ============================================
  // EXPORTAR DATOS DEL USUARIO (GDPR)
  // ============================================
  
  const handleExportData = async () => {
    setError('');
    setSuccessMessage('');
    
    try {
      trackEvent('profile_export_data_start');
      
      // Obtener datos del perfil
      const userDoc = await getDoc(doc(db, 'users', userUid));
      const profileData = userDoc.exists() ? userDoc.data() : null;
      
      // Obtener recetas guardadas
      const savedRecipesQuery = query(
        collection(db, 'saved_recipes'),
        where('user_id', '==', userUid)
      );
      const savedRecipesSnap = await getDocs(savedRecipesQuery);
      const savedRecipes = savedRecipesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Obtener restaurantes guardados
      const savedRestaurantsQuery = query(
        collection(db, 'saved_restaurants'),
        where('user_id', '==', userUid)
      );
      const savedRestaurantsSnap = await getDocs(savedRestaurantsQuery);
      const savedRestaurants = savedRestaurantsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Obtener historial de feedback
      const feedbackQuery = query(
        collection(db, 'user_history'),
        where('userId', '==', userUid)
      );
      const feedbackSnap = await getDocs(feedbackQuery);
      const feedback = feedbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Obtener datos de auth
      const currentUser = auth.currentUser;
      const authData = currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        emailVerified: currentUser.emailVerified,
        createdAt: currentUser.metadata.creationTime,
        lastSignInTime: currentUser.metadata.lastSignInTime,
      } : null;
      
      const exportPayload = {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        user: authData,
        profile: profileData,
        savedRecipes,
        savedRestaurants,
        feedback,
      };
      
      setExportedData(exportPayload);
      trackEvent('profile_export_data_success');
      
    } catch (err) {
      safeLog('error', 'Error exporting data:', err);
      trackEvent('profile_export_data_error');
      setError('Error al exportar los datos. Intenta de nuevo.');
    }
  };
  
  const handleDownloadJSON = () => {
    if (!exportedData) return;
    
    const dataStr = JSON.stringify(exportedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bocado-datos-${userUid}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    trackEvent('profile_export_data_download');
    setSuccessMessage('¡Archivo descargado!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };
  
  // ============================================
  // ELIMINAR CUENTA (GDPR - Derecho al olvido)
  // ============================================
  
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (deleteConfirmText !== 'ELIMINAR') {
      setError('Debes escribir ELIMINAR para confirmar.');
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setError('Sesión expirada. Vuelve a iniciar sesión.');
      return;
    }
    
    setIsDeleting(true);
    
    try {
      trackEvent('profile_delete_account_start');
      
      // 1. Reautenticar
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // 2. Eliminar datos de Firestore
      // Eliminar perfil
      await deleteDoc(doc(db, 'users', userUid));
      
      // Eliminar recetas guardadas
      const savedRecipesQuery = query(
        collection(db, 'saved_recipes'),
        where('user_id', '==', userUid)
      );
      const savedRecipesSnap = await getDocs(savedRecipesQuery);
      const deleteRecipesPromises = savedRecipesSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteRecipesPromises);
      
      // Eliminar restaurantes guardados
      const savedRestaurantsQuery = query(
        collection(db, 'saved_restaurants'),
        where('user_id', '==', userUid)
      );
      const savedRestaurantsSnap = await getDocs(savedRestaurantsQuery);
      const deleteRestaurantsPromises = savedRestaurantsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteRestaurantsPromises);
      
      // Eliminar historial de feedback
      const feedbackQuery = query(
        collection(db, 'user_history'),
        where('userId', '==', userUid)
      );
      const feedbackSnap = await getDocs(feedbackQuery);
      const deleteFeedbackPromises = feedbackSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteFeedbackPromises);
      
      // 3. Eliminar usuario de Firebase Auth
      await deleteUser(currentUser);
      
      trackEvent('profile_delete_account_success');
      
      // 4. Limpiar sesión
      if (onLogout) {
        onLogout();
      }
      
    } catch (err: any) {
      safeLog('error', 'Error deleting account:', err);
      trackEvent('profile_delete_account_error', { code: err.code });
      
      if (err.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Por seguridad, cierra sesión y vuelve a iniciar sesión antes de eliminar tu cuenta.');
      } else {
        setError('Error al eliminar la cuenta. Contacta a soporte.');
      }
      setIsDeleting(false);
    }
  };

  const renderPhysicalData = () => {
    const parts: string[] = [];
    if (formData.weight) parts.push(`${formData.weight} kg`);
    if (formData.height) parts.push(`${formData.height} cm`);
    
    if (parts.length === 0) return null;
    
    // Calculamos IMC para mostrar solo el número sin etiquetas clínicas
    // que puedan ser desmotivantes para el usuario
    let bmi = null;
    if (formData.weight && formData.height) {
      const w = parseFloat(formData.weight);
      const h = parseInt(formData.height) / 100;
      if (w > 0 && h > 0) {
        bmi = (w / (h * h)).toFixed(1);
      }
    }
    
    return (
      <InfoSection title="Datos Corporales">
        <Badge text={parts.join(' / ')} color="yellow" />
        {bmi && (
          <Badge 
            text={`IMC: ${bmi}`} 
            color="gray" 
            title="Índice de masa corporal"
          />
        )}
      </InfoSection>
    );
  };

  const renderContent = () => {
    switch(viewMode) {
      case 'edit':
        return (
          <div className="flex flex-col h-full animate-fade-in">
            <div className="flex-1 overflow-y-auto space-y-6 pb-4">
              {error && <p className="text-red-500 text-xs text-center bg-red-50 p-3 rounded-xl">{error}</p>}
              
              <Step1 
                data={formData} 
                updateData={updateData} 
                errors={{}} 
                hidePasswordFields={true} 
                disableEmail={true}
                cityOptions={cityOptions}
                isSearchingCity={isSearchingCity}
                onSearchCity={handleCitySearch}
                onClearCityOptions={() => setCityOptions([])}
                onCountryChange={(code) => updateData('country', code)}
              />
              <Step2 data={formData} updateData={updateData} errors={{}} />
              <Step3 data={formData} updateData={updateData} errors={{}} />
            </div>
            
            <div className="bg-white p-4 border-t border-bocado-border flex gap-3 shrink-0">
                <button 
                  onClick={() => { 
                    trackEvent('profile_edit_cancel');
                    setViewMode('view'); 
                    setFormData(initialFormData); 
                    setError('');
                    setCityOptions([]);
                  }} 
                  className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                  disabled={updateProfileMutation.isPending}
                >
                    Cancelar
                </button>
                <button 
                  onClick={handleSaveProfile} 
                  className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray" 
                  disabled={updateProfileMutation.isPending}
                >
                    {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
          </div>
        );
        
      case 'changePassword':
         return (
            <div className="animate-fade-in">
                 <h2 className="text-lg font-bold text-bocado-dark-green mb-4">Cambiar Contraseña</h2>
                 <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">Contraseña Actual</label>
                        <input 
                          type="password" 
                          value={currentPassword} 
                          onChange={(e) => setCurrentPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">Nueva Contraseña</label>
                        <input 
                          type="password" 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="Mínimo 8 caracteres" 
                        />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">Confirmar</label>
                        <input 
                          type="password" 
                          value={confirmNewPassword} 
                          onChange={(e) => setConfirmNewPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    {error && <p className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                    {successMessage && <p className="text-green-600 text-xs text-center bg-green-50 p-2 rounded-lg">{successMessage}</p>}
                    <div className="flex gap-3 mt-6">
                        <button 
                          type="button" 
                          onClick={() => {
                            setViewMode('view');
                            setError('');
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                          }} 
                          className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
                        >
                            Actualizar
                        </button>
                    </div>
                 </form>
            </div>
          );
          
      case 'changeEmail':
          return (
            <div className="animate-fade-in">
                 <h2 className="text-xl font-bold text-bocado-dark-green mb-2">Cambiar Correo</h2>
                 <p className="text-sm text-bocado-gray mb-4">Se enviará un link de verificación.</p>
                 <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">Contraseña</label>
                        <input 
                          type="password" 
                          value={emailPassword} 
                          onChange={(e) => setEmailPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">Nuevo Correo</label>
                        <input 
                          type="email" 
                          value={newEmail} 
                          onChange={(e) => setNewEmail(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="nuevo@correo.com" 
                        />
                    </div>
                    {error && <p className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                    {successMessage && <p className="text-green-600 text-xs text-center bg-green-50 p-2 rounded-lg">{successMessage}</p>}
                    <div className="flex gap-3 mt-6">
                        <button 
                          type="button" 
                          onClick={() => {
                            setViewMode('view');
                            setError('');
                            setEmailPassword('');
                            setNewEmail('');
                          }} 
                          className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
                        >
                            Cambiar
                        </button>
                    </div>
                 </form>
            </div>
          );
          
      case 'exportData':
        return (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-bocado-dark-green mb-2">Exportar mis datos</h2>
            <p className="text-sm text-bocado-gray mb-6">
              Descarga una copia de todos tus datos personales guardados en Bocado.
            </p>
            
            {!exportedData ? (
              <div className="space-y-4">
                <div className="bg-bocado-background/50 p-4 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <DocumentTextIcon className="w-5 h-5 text-bocado-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-bocado-text">¿Qué incluye?</p>
                      <ul className="text-xs text-bocado-gray mt-1 space-y-1">
                        <li>• Tu perfil y preferencias</li>
                        <li>• Recetas guardadas</li>
                        <li>• Restaurantes guardados</li>
                        <li>• Historial de feedback</li>
                        <li>• Información de cuenta</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {error && <p className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                
                <div className="flex gap-3 mt-6">
                  <button 
                    type="button" 
                    onClick={() => {
                      setViewMode('view');
                      setError('');
                    }} 
                    className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                  >
                    Volver
                  </button>
                  <button 
                    onClick={handleExportData}
                    className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Preparar datos
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-semibold text-green-800">¡Datos listos!</p>
                  </div>
                  <p className="text-xs text-green-700">
                    Tu archivo incluye {Object.keys(exportedData).length} secciones de datos.
                  </p>
                </div>
                
                {successMessage && (
                  <p className="text-green-600 text-xs text-center bg-green-50 p-2 rounded-lg">{successMessage}</p>
                )}
                
                <div className="flex gap-3 mt-6">
                  <button 
                    type="button" 
                    onClick={() => {
                      setViewMode('view');
                      setExportedData(null);
                      setError('');
                    }} 
                    className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                  >
                    Cerrar
                  </button>
                  <button 
                    onClick={handleDownloadJSON}
                    className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Descargar JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'deleteAccount':
        return (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <ExclamationIcon className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-red-600">Eliminar cuenta</h2>
            </div>
            
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
              <p className="text-sm font-semibold text-red-800 mb-2">⚠️ Esta acción no se puede deshacer</p>
              <p className="text-xs text-red-700">
                Se eliminarán permanentemente:
              </p>
              <ul className="text-xs text-red-700 mt-2 space-y-1 ml-4">
                <li>• Tu perfil y todas tus preferencias</li>
                <li>• Todas las recetas guardadas</li>
                <li>• Todos los restaurantes guardados</li>
                <li>• Tu historial de recomendaciones</li>
                <li>• Tu cuenta de acceso</li>
              </ul>
            </div>
            
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">
                  Escribe ELIMINAR para confirmar
                </label>
                <input 
                  type="text" 
                  value={deleteConfirmText} 
                  onChange={(e) => setDeleteConfirmText(e.target.value)} 
                  className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" 
                  placeholder="ELIMINAR"
                />
              </div>
              
              <div>
                <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">
                  Tu contraseña
                </label>
                <input 
                  type="password" 
                  value={deletePassword} 
                  onChange={(e) => setDeletePassword(e.target.value)} 
                  className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                  placeholder="••••••••"
                />
              </div>
              
              {error && <p className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</p>}
              
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setViewMode('view');
                    setError('');
                    setDeletePassword('');
                    setDeleteConfirmText('');
                  }} 
                  className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isDeleting || deleteConfirmText !== 'ELIMINAR' || !deletePassword}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <TrashIcon className="w-4 h-4" />
                      Eliminar todo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        );
          
      case 'view':
      default:
        return (
             <div className="space-y-4">
                 {successMessage && <p className="text-green-600 text-xs text-center bg-green-50 p-3 rounded-xl animate-fade-in font-medium">{successMessage}</p>}
                 
                 <InfoSection title="Información Personal">
                    {formData.gender && <Badge text={formData.gender} color="gray" />}
                    {formData.age && <Badge text={`${formData.age} años`} color="gray" />}
                    {formData.city && formData.country && (
                      <Badge text={`${formData.city}, ${formData.country}`} color="gray" />
                    )}
                    {formData.cookingAffinity && (
                      <Badge text={`Cocina: ${formData.cookingAffinity}`} color="gray" />
                    )}
                 </InfoSection>

                 {renderPhysicalData()}

                 <InfoSection title="Objetivo Nutricional">
                    {formData.nutritionalGoal.length > 0 && formData.nutritionalGoal[0] !== 'Sin especificar' 
                      ? formData.nutritionalGoal.map(g => <Badge key={g} text={g} color="green" />) 
                      : <span className="text-xs text-bocado-gray">No especificado</span>
                    }
                 </InfoSection>

                 <InfoSection title="Actividad Física">
                    {formData.activityLevel ? (
                      <Badge 
                        text={`${stripEmoji(formData.activityLevel)}${formData.activityFrequency ? ` (${formData.activityFrequency})` : ''}`} 
                        color="gray" 
                      />
                    ) : (
                      <span className="text-xs text-bocado-gray">No especificado</span>
                    )}
                 </InfoSection>

                 <InfoSection title="Salud">
                    {formData.diseases.length > 0 && formData.diseases[0] !== 'Ninguna' 
                      ? formData.diseases.map(d => <Badge key={d} text={d} color="red" />) 
                      : <span className="text-xs text-bocado-gray">Sin condiciones</span>
                    }
                 </InfoSection>

                 <InfoSection title="Alergias">
                    {formData.allergies.length > 0 && formData.allergies[0] !== 'Ninguna' ? (
                        <>
                            {formData.allergies.map(a => <Badge key={a} text={a} color="blue" />)}
                            {formData.otherAllergies && <Badge text={formData.otherAllergies} color="blue" />}
                        </>
                    ) : (
                        <span className="text-xs text-bocado-gray">Ninguna</span>
                    )}
                 </InfoSection>

                 <InfoSection title="No me gusta">
                    {formData.dislikedFoods.length > 0 && formData.dislikedFoods[0] !== 'Ninguno' 
                      ? formData.dislikedFoods.map(f => <Badge key={f} text={f} color="red" />) 
                      : <span className="text-xs text-bocado-gray">Ninguno</span>
                    }
                 </InfoSection>

                 <div className="mt-6 pt-6 border-t border-bocado-border">
                    <div className="flex items-center gap-2 mb-3">
                        <LockIcon className="w-4 h-4 text-bocado-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-2xs uppercase tracking-wider">Seguridad</h3>
                    </div>
                    <div className="space-y-2">
                        <button 
                          onClick={() => {
                            trackEvent('profile_security_mode_change', { mode: 'password' });
                            setViewMode('changePassword');
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <span>Cambiar Contraseña</span>
                            <span className="text-bocado-gray">›</span>
                        </button>
                        <button 
                          onClick={() => {
                            trackEvent('profile_security_mode_change', { mode: 'email' });
                            setViewMode('changeEmail');
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <span>Cambiar Correo</span>
                            <span className="text-bocado-gray">›</span>
                        </button>
                    </div>
                 </div>
                 
                 {/* Preferencias */}
                 <div className="mt-6 pt-6 border-t border-bocado-border">
                    <div className="flex items-center gap-2 mb-3">
                        <BellIcon className="w-4 h-4 text-bocado-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-2xs uppercase tracking-wider">Preferencias</h3>
                    </div>
                    <div className="space-y-2">
                        <button 
                          onClick={() => {
                            trackEvent('profile_notifications_open');
                            setShowNotificationSettings(true);
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <BellIcon className="w-4 h-4 text-bocado-green" />
                                <span>Recordatorios y notificaciones</span>
                            </div>
                            <span className="text-bocado-gray">›</span>
                        </button>
                    </div>
                 </div>
                 
                 {/* Privacidad y Datos (GDPR) */}
                 <div className="mt-6 pt-6 border-t border-bocado-border">
                    <div className="flex items-center gap-2 mb-3">
                        <DocumentTextIcon className="w-4 h-4 text-bocado-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-2xs uppercase tracking-wider">Privacidad y Datos</h3>
                    </div>
                    <div className="space-y-2">
                        <button 
                          onClick={() => {
                            trackEvent('profile_privacy_mode_change', { mode: 'export' });
                            setViewMode('exportData');
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <DownloadIcon className="w-4 h-4 text-bocado-green" />
                                <span>Descargar mis datos</span>
                            </div>
                            <span className="text-bocado-gray">›</span>
                        </button>
                        <button 
                          onClick={() => {
                            trackEvent('profile_privacy_mode_change', { mode: 'delete' });
                            setViewMode('deleteAccount');
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-red-50 rounded-xl text-sm font-medium text-red-600 hover:bg-red-100 active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <TrashIcon className="w-4 h-4" />
                                <span>Eliminar mi cuenta</span>
                            </div>
                            <span className="text-red-400">›</span>
                        </button>
                    </div>
                 </div>
                 
                 {/* Logout */}
                 {onLogout && (
                    <div className="mt-6 pt-6 border-t border-bocado-border">
                        <button 
                          onClick={() => {
                            trackEvent('profile_logout_click');
                            onLogout();
                          }} 
                          className="w-full py-3 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors active:scale-95"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                 )}
            </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-4 pt-2">
            <div className="flex items-center gap-2">
                <div className="bg-bocado-green/10 p-2 rounded-full">
                    <UserIcon className="w-5 h-5 text-bocado-green"/>
                </div>
                <div>
                    <h1 className="text-lg font-bold text-bocado-dark-green">Mi Perfil</h1>
                    <p className="text-xs text-bocado-gray truncate max-w-[150px]">{formData.email}</p>
                </div>
            </div>
            {viewMode === 'view' && (
                <button 
                  onClick={() => {
                    trackEvent('profile_edit_start'); // ✅ Analítica
                    setViewMode('edit');
                  }} 
                  className="text-xs bg-bocado-green/10 text-bocado-green font-bold px-3 py-1.5 rounded-full hover:bg-bocado-green/20 active:scale-95 transition-all"
                >
                    Editar
                </button>
            )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 no-scrollbar">
            {renderContent()}
        </div>
        
        {/* Modal de Notificaciones */}
        <NotificationSettings 
          isOpen={showNotificationSettings} 
          onClose={() => setShowNotificationSettings(false)} 
          userUid={userUid}
        />
    </div>
  );
};

export default ProfileScreen;