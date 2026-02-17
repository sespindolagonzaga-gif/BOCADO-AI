import React, { useState, useEffect } from 'react';
import { FormData, UserProfile } from '../types';
import { User, Lock, Download, Trash2, AlertTriangle, FileText, Bell } from './icons';
import Step1 from './form-steps/Step1';
import Step2 from './form-steps/Step2';
import Step3 from './form-steps/Step3';
import NotificationSettings from './NotificationSettings';
import NotificationTokensAdmin from './NotificationTokensAdmin';
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
import { ADMIN_UIDS } from '../config/featureFlags';
import { searchCities, getPlaceDetails, PlacePrediction } from '../services/mapsService';
import { ProfileSkeleton } from './skeleton';
import { useTranslation } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';

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
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isAdmin = ADMIN_UIDS.includes(userUid);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'changePassword' | 'changeEmail' | 'exportData' | 'deleteAccount' | 'adminNotifications'>('view');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  const { user } = useAuthStore();
  const { data: profile, isLoading: isProfileLoading } = useUserProfile(userUid);
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
  
  const [cityOptions, setCityOptions] = useState<PlacePrediction[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');;
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // ✅ ANALÍTICA: Trackeo de entrada a la pantalla
  useEffect(() => {
    trackEvent('profile_screen_view', { userId: userUid });
  }, [userUid]);

  useEffect(() => {
    if (viewMode === 'adminNotifications' && !isAdmin) {
      setViewMode('view');
    }
  }, [viewMode, isAdmin]);

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
        const predictions = await searchCities(query, countryCode);
        setCityOptions(predictions);
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

      // Obtener coordenadas de la ciudad si hay placeId seleccionado
      let location = profile?.location;
      if (selectedPlaceId) {
        try {
          const placeDetails = await getPlaceDetails(selectedPlaceId);
          if (placeDetails) {
            location = {
              lat: placeDetails.lat,
              lng: placeDetails.lng,
            };
          }
        } catch (error) {
          safeLog('warn', 'Error obteniendo coordenadas de la ciudad:', error);
        }
      }

      const userProfile: UserProfile = {
        uid: userUid,
        gender: profileData.gender,
        age: profileData.age,
        weight: profileData.weight,
        height: profileData.height,
        country: profileData.country.toUpperCase(),
        city: profileData.city,
        location,
        locationEnabled: profile?.locationEnabled || false,
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
      
      // 💰 FINOPS: Invalidar cache del perfil después de actualizarlo
      try {
        await fetch('/api/invalidate-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userUid, type: 'profile' })
        });
      } catch (cacheError) {
        // No crítico - continuar sin cache invalidation
        safeLog('warn', 'Failed to invalidate profile cache:', cacheError);
      }
      
      // ✅ ANALÍTICA: Perfil actualizado correctamente
      trackEvent('profile_update_success', {
        goals: userProfile.nutritionalGoal.join(','),
        has_allergies: userProfile.allergies.length > 0
      });

      setInitialFormData(formData);
      setViewMode('view');
      setSuccessMessage(t('profile.success.profileUpdated'));
      onProfileUpdate(authData.firstName);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      safeLog('error', "Error updating profile:", err);
      // ✅ ANALÍTICA: Error en actualización
      trackEvent('profile_update_error');
      setError(t('profile.errors.saveError'));
    }
  };

  const updateData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Si cambia la ciudad, guardar el placeId para obtener coordenadas después
    if (field === 'cityPlaceId') {
      setSelectedPlaceId(value);
    }
    
    // Si cambia el país, limpiar ciudad y placeId
    if (field === 'country') {
      setSelectedPlaceId('');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        setError(t('profile.errors.allRequired'));
        return;
    }
    if (newPassword !== confirmNewPassword) {
        setError(t('profile.errors.passwordsMismatch'));
        return;
    }
    if (newPassword.length < 8) {
        setError(t('profile.errors.minChars'));
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        setError(t('profile.errors.sessionExpired'));
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        // ✅ ANALÍTICA: Password cambiado
        trackEvent('profile_security_password_changed');

        setSuccessMessage(t('profile.success.passwordUpdated'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setViewMode('view'), 2000);
    } catch (err: any) {
        trackEvent('profile_security_password_error', { code: err.code });
        if (err.code === 'auth/wrong-password') setError(t('profile.errors.wrongPassword'));
        else setError(t('profile.errors.updateError'));
    }
  };
  
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!emailPassword || !newEmail) {
        setError(t('profile.errors.allRequired'));
        return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        setError(t('profile.errors.sessionExpiredShort'));
        return;
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    if (currentUser.email.toLowerCase() === normalizedNewEmail) {
        setError(t('profile.errors.sameEmail'));
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
        setSuccessMessage(t('profile.success.emailUpdated'));
        
        setEmailPassword('');
        setNewEmail('');
        setTimeout(() => setViewMode('view'), 4000);
    } catch (err: any) {
        trackEvent('profile_security_email_error', { code: err.code });
        if (err.code === 'auth/wrong-password') setError(t('profile.errors.wrongPasswordShort'));
        else if (err.code === 'auth/email-already-in-use') setError(t('profile.errors.emailInUse'));
        else setError(t('profile.errors.updateError'));
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
      setError(t('profile.errors.exportError'));
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
    setSuccessMessage(t('profile.success.downloadComplete'));
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
      setError(t('profile.errors.mustTypeDelete'));
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setError(t('profile.errors.sessionExpired'));
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

  const translateGender = (gender: string): string => {
    if (gender === 'Hombre') return t('gender.male');
    if (gender === 'Mujer') return t('gender.female');
    return gender;
  };

  const translateCookingAffinity = (affinity: string): string => {
    const map: Record<string, string> = {
      'Nunca': 'nunca',
      'A veces': 'aveces',
      'Seguido': 'seguido',
      'Siempre': 'siempre'
    };
    const key = map[affinity];
    return key ? t(`cookingAffinity.${key}`) : affinity;
  };

  const translateGoal = (goal: string): string => {
    const map: Record<string, string> = {
      'Bajar de peso': 'loseWeight',
      'Subir de peso': 'gainWeight',
      'Generar músculo': 'buildMuscle',
      'Salud y bienestar': 'healthWellness'
    };
    const key = map[goal];
    return key ? t(`goals.${key}`) : goal;
  };

  const translateActivityLevel = (level: string): string => {
    const map: Record<string, string> = {
      'Sedentario': 'sedentary',
      'Activo ligero': 'lightlyActive',
      'Fuerza': 'strength',
      'Cardio': 'cardio',
      'Deportivo': 'athletic',
      'Atleta': 'athlete',
      'Otro': 'other'
    };
    // Remover emoji primero
    const textOnly = stripEmoji(level);
    const key = map[textOnly];
    return key ? t(`activityLevels.${key}`) : level;
  };

  const translateActivityFrequency = (freq: string): string => {
    const map: Record<string, string> = {
      'Diario': 'daily',
      '3-5 veces por semana': 'frequent',
      '1-2 veces': 'occasional',
      'Rara vez': 'rarely'
    };
    const key = map[freq];
    return key ? t(`activityFrequencies.${key}`) : freq;
  };

  const translateDisease = (disease: string): string => {
    const map: Record<string, string> = {
      'Hipertensión': 'hypertension',
      'Diabetes': 'diabetes',
      'Hipotiroidismo': 'hypothyroidism',
      'Hipertiroidismo': 'hyperthyroidism',
      'Colesterol': 'cholesterol',
      'Intestino irritable': 'ibs'
    };
    const key = map[disease];
    return key ? t(`diseases.${key}`) : disease;
  };

  const translateAllergy = (allergy: string): string => {
    const map: Record<string, string> = {
      'Intolerante a la lactosa': 'lactoseIntolerant',
      'Alergia a frutos secos': 'nutAllergy',
      'Celíaco': 'celiac',
      'Vegano': 'vegan',
      'Vegetariano': 'vegetarian',
      'Otro': 'other'
    };
    const key = map[allergy];
    return key ? t(`allergies.${key}`) : allergy;
  };

  const translateFood = (foodKey: string): string => {
    // Si el alimento está en las traducciones, usarlas
    // De lo contrario, retornar el key original (alimento personalizado)
    return t(`foods.${foodKey}`, { defaultValue: foodKey });
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
      <InfoSection title={t('profile.view.bodyData')}>
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
                    {t('common.cancel')}
                </button>
                <button 
                  onClick={handleSaveProfile} 
                  className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray" 
                  disabled={updateProfileMutation.isPending}
                >
                    {updateProfileMutation.isPending ? t('common.saving') : t('profile.saveChanges')}
                </button>
            </div>
          </div>
        );
        
      case 'changePassword':
         return (
            <div className="animate-fade-in">
                 <h2 className="text-lg font-bold text-bocado-dark-green mb-4">{t('profile.changePassword')}</h2>
                 <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('profile.currentPassword')}</label>
                        <input 
                          type="password" 
                          value={currentPassword} 
                          onChange={(e) => setCurrentPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('profile.newPassword')}</label>
                        <input 
                          type="password" 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder={t('registration.placeholders.password')} 
                        />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('profile.confirmPassword')}</label>
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
                            {t('common.cancel')}
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
                        >
                            {t('profile.update')}
                        </button>
                    </div>
                 </form>
            </div>
          );
          
      case 'changeEmail':
          return (
            <div className="animate-fade-in">
                 <h2 className="text-xl font-bold text-bocado-dark-green mb-2">{t('profile.changeEmail')}</h2>
                 <p className="text-sm text-bocado-gray mb-4">{t('profile.emailVerificationNote')}</p>
                 <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('profile.currentPassword')}</label>
                        <input 
                          type="password" 
                          value={emailPassword} 
                          onChange={(e) => setEmailPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('profile.newEmail')}</label>
                        <input 
                          type="email" 
                          value={newEmail} 
                          onChange={(e) => setNewEmail(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder={t('registration.placeholders.email')} 
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
                            {t('common.cancel')}
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
                        >
                            {t('profile.change')}
                        </button>
                    </div>
                 </form>
            </div>
          );

      case 'adminNotifications':
        if (!isAdmin) return null;
        return (
          <NotificationTokensAdmin
            userUid={userUid}
            onBack={() => setViewMode('view')}
          />
        );
          
      case 'exportData':
        return (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-bocado-dark-green mb-2">{t('profile.downloadData')}</h2>
            <p className="text-sm text-bocado-gray mb-6">
              {t('profile.deleteDataDesc')}
            </p>
            
            {!exportedData ? (
              <div className="space-y-4">
                <div className="bg-bocado-background/50 p-4 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-bocado-green mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-bocado-text">{t('profile.whatIncluded')}</p>
                      <ul className="text-xs text-bocado-gray mt-1 space-y-1">
                        <li>• {t('profile.dataIncludes.profile')}</li>
                        <li>• {t('profile.dataIncludes.recipes')}</li>
                        <li>• {t('profile.dataIncludes.restaurants')}</li>
                        <li>• {t('profile.dataIncludes.history')}</li>
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
                    {t('common.back')}
                  </button>
                  <button 
                    onClick={handleExportData}
                    className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('profile.prepareData')}
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
                    <p className="text-sm font-semibold text-green-800">{t('profile.dataReady')}</p>
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
                    {t('common.close')}
                  </button>
                  <button 
                    onClick={handleDownloadJSON}
                    className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('profile.downloadJSON')}
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
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-red-600">{t('profile.deleteAccount')}</h2>
            </div>
            
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
              <p className="text-sm font-semibold text-red-800 mb-2">{t('profile.deleteWarning')}</p>
              <p className="text-xs text-red-700">
                {t('common.deleting')}:
              </p>
              <ul className="text-xs text-red-700 mt-2 space-y-1 ml-4">
                <li>• {t('profile.deleteIncludes.account')}</li>
                <li>• {t('profile.deleteIncludes.profile')}</li>
                <li>• {t('profile.deleteIncludes.recipes')}</li>
                <li>• {t('profile.deleteIncludes.restaurants')}</li>
                <li>• {t('profile.deleteIncludes.feedback')}</li>
              </ul>
            </div>
            
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">
                  {t('profile.deleteConfirmText')}
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
                  {t('profile.currentPassword')}
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
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isDeleting || deleteConfirmText !== 'ELIMINAR' || !deletePassword}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('common.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('profile.deleteAll')}
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
                 
                 <InfoSection title={t('profile.personalInfo')}>
                    {formData.gender && <Badge text={translateGender(formData.gender)} color="gray" />}
                    {formData.age && <Badge text={`${formData.age}${t('profile.suffixYears')}`} color="gray" />}
                    {formData.city && formData.country && (
                      <Badge text={`${formData.city}, ${formData.country}`} color="gray" />
                    )}
                    {formData.cookingAffinity && (
                      <Badge text={`${t('profile.prefixCooking')}${translateCookingAffinity(formData.cookingAffinity)}`} color="gray" />
                    )}
                 </InfoSection>

                 {renderPhysicalData()}

                 <InfoSection title={t('profile.nutritionalGoal')}>
                    {formData.nutritionalGoal.length > 0 && formData.nutritionalGoal[0] !== 'Sin especificar' 
                      ? formData.nutritionalGoal.map(g => <Badge key={g} text={translateGoal(g)} color="green" />) 
                      : <span className="text-xs text-bocado-gray">{t('profile.noSpecified')}</span>
                    }
                 </InfoSection>

                 <InfoSection title={t('profile.physicalActivity')}>
                    {formData.activityLevel ? (
                      <Badge 
                        text={`${translateActivityLevel(formData.activityLevel)}${formData.activityFrequency ? ` (${translateActivityFrequency(formData.activityFrequency)})` : ''}`} 
                        color="gray" 
                      />
                    ) : (
                      <span className="text-xs text-bocado-gray">{t('profile.noSpecified')}</span>
                    )}
                 </InfoSection>

                 <InfoSection title={t('profile.health')}>
                    {formData.diseases.length > 0 && formData.diseases[0] !== 'Ninguna' 
                      ? formData.diseases.map(d => <Badge key={d} text={translateDisease(d)} color="red" />) 
                      : <span className="text-xs text-bocado-gray">{t('profile.noConditions')}</span>
                    }
                 </InfoSection>

                 <InfoSection title={t('profile.allergies')}>
                    {formData.allergies.length > 0 && formData.allergies[0] !== 'Ninguna' ? (
                        <>
                            {formData.allergies.map(a => <Badge key={a} text={translateAllergy(a)} color="blue" />)}
                            {formData.otherAllergies && <Badge text={formData.otherAllergies} color="blue" />}
                        </>
                    ) : (
                        <span className="text-xs text-bocado-gray">{t('profile.none')}</span>
                    )}
                 </InfoSection>

                 <InfoSection title={t('profile.dislikes')}>
                    {formData.dislikedFoods.length > 0 && formData.dislikedFoods[0] !== 'Ninguno' 
                      ? formData.dislikedFoods.map(f => <Badge key={f} text={translateFood(f)} color="red" />) 
                      : <span className="text-xs text-bocado-gray">{t('profile.noneM')}</span>
                    }
                 </InfoSection>

                 <div className="mt-6 pt-6 border-t border-bocado-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Lock className="w-4 h-4 text-bocado-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-2xs uppercase tracking-wider">{t('profile.security')}</h3>
                    </div>
                    <div className="space-y-2">
                        <button 
                          onClick={() => {
                            trackEvent('profile_security_mode_change', { mode: 'password' });
                            setViewMode('changePassword');
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <span>{t('profile.changePassword')}</span>
                            <span className="text-bocado-gray">›</span>
                        </button>
                        <button 
                          onClick={() => {
                            trackEvent('profile_security_mode_change', { mode: 'email' });
                            setViewMode('changeEmail');
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <span>{t('profile.changeEmail')}</span>
                            <span className="text-bocado-gray">›</span>
                        </button>
                    </div>
                 </div>
                 
                 {/* Preferencias */}
                 <div className="mt-6 pt-6 border-t border-bocado-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Bell className="w-4 h-4 text-bocado-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-2xs uppercase tracking-wider">{t('profile.preferences')}</h3>
                    </div>
                    <div className="space-y-2">
                        {/* Selector de Idioma */}
                        <div className="px-4 py-3 bg-bocado-background rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-bocado-text">{t('profile.language')}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    trackEvent('language_change', { from: locale, to: 'es' });
                                    setLocale('es');
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                    locale === 'es'
                                      ? 'bg-bocado-green text-white'
                                      : 'bg-white text-bocado-gray hover:bg-bocado-border'
                                  }`}
                                >
                                  {t('profile.languageES')}
                                </button>
                                <button
                                  onClick={() => {
                                    trackEvent('language_change', { from: locale, to: 'en' });
                                    setLocale('en');
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                    locale === 'en'
                                      ? 'bg-bocado-green text-white'
                                      : 'bg-white text-bocado-gray hover:bg-bocado-border'
                                  }`}
                                >
                                  {t('profile.languageEN')}
                                </button>
                            </div>
                        </div>
                        
                        {/* Selector de Tema */}
                        <div className="px-4 py-3 bg-bocado-background rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-bocado-text">{t('profile.theme')}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    trackEvent('theme_change', { from: theme, to: 'light' });
                                    setTheme('light');
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                    theme === 'light'
                                      ? 'bg-bocado-green text-white'
                                      : 'bg-white text-bocado-gray hover:bg-bocado-border'
                                  }`}
                                >
                                  {t('profile.themeLight')}
                                </button>
                                <button
                                  onClick={() => {
                                    trackEvent('theme_change', { from: theme, to: 'dark' });
                                    setTheme('dark');
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                    theme === 'dark'
                                      ? 'bg-bocado-green text-white'
                                      : 'bg-white text-bocado-gray hover:bg-bocado-border'
                                  }`}
                                >
                                  {t('profile.themeDark')}
                                </button>
                                <button
                                  onClick={() => {
                                    trackEvent('theme_change', { from: theme, to: 'system' });
                                    setTheme('system');
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                    theme === 'system'
                                      ? 'bg-bocado-green text-white'
                                      : 'bg-white text-bocado-gray hover:bg-bocado-border'
                                  }`}
                                >
                                  {t('profile.themeSystem')}
                                </button>
                            </div>
                        </div>
                        
                        <button 
                          onClick={() => {
                            trackEvent('profile_notifications_open');
                            setShowNotificationSettings(true);
                          }} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-bocado-green" />
                                <span>{t('profile.notificationsDesc')}</span>
                            </div>
                            <span className="text-bocado-gray">›</span>
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              trackEvent('profile_notifications_admin_open');
                              setViewMode('adminNotifications');
                            }} 
                            className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                          >
                              <div className="flex items-center gap-2">
                                  <Bell className="w-4 h-4 text-bocado-green" />
                                  <span>{t('profile.adminTokens')}</span>
                              </div>
                              <span className="text-bocado-gray">›</span>
                          </button>
                        )}
                    </div>
                 </div>
                 
                 {/* Privacidad y Datos (GDPR) */}
                 <div className="mt-6 pt-6 border-t border-bocado-border">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-bocado-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-2xs uppercase tracking-wider">{t('profile.privacy')}</h3>
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
                                <Download className="w-4 h-4 text-bocado-green" />
                                <span>{t('profile.downloadData')}</span>
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
                                <Trash2 className="w-4 h-4" />
                                <span>{t('profile.deleteAccount')}</span>
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
                            {t('profile.logout')}
                        </button>
                    </div>
                 )}
            </div>
        );
    }
  };

  // Mostrar skeleton mientras carga el perfil
  if (isProfileLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-4 pt-2">
            <div className="flex items-center gap-2">
                <div className="bg-bocado-green/10 p-2 rounded-full">
                    <User className="w-5 h-5 text-bocado-green"/>
                </div>
                <div>
                    <h1 className="text-lg font-bold text-bocado-dark-green">{t('profile.title')}</h1>
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
                    {t('profile.edit')}
                </button>
            )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar min-h-0">
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