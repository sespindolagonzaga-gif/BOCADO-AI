import React, { useState, useEffect } from 'react';
import { FormData, UserProfile } from '../types';
import { UserIcon } from './icons/UserIcon';
import { LockIcon } from './icons/LockIcon';
import Step1 from './form-steps/Step1';
import Step2 from './form-steps/Step2';
import Step3 from './form-steps/Step3';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updateEmail, 
  sendEmailVerification, 
  updateProfile 
} from 'firebase/auth';
import { sanitizeProfileData, separateUserData } from '../utils/profileSanitizer';
import { useUserProfileStore } from '../stores/userProfileStore'; // ✅ Nuevo
import { useAuthStore } from '../stores/authStore'; // ✅ Nuevo
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

// ✅ Helper para construir FormData desde Auth + Profile Store
const buildFormData = (user: any, profile: UserProfile | null): FormData => {
  const nameParts = user?.displayName?.split(' ') || ['', ''];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return {
    firstName,
    lastName,
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    // Datos del profile de Firestore (o defaults)
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
        <h3 className="text-[10px] font-bold text-bocado-gray uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex flex-wrap gap-2">{children}</div>
    </div>
);

const Badge: React.FC<{ text: string; color: 'green' | 'blue' | 'red' | 'gray' | 'yellow' }> = ({ text, color }) => {
    const colors = {
        green: 'bg-green-100 text-green-700',
        blue: 'bg-blue-100 text-blue-700',
        red: 'bg-red-100 text-red-700',
        gray: 'bg-bocado-background text-bocado-dark-gray',
        yellow: 'bg-yellow-100 text-yellow-700',
    };
    return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colors[color]}`}>{text}</span>;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, onProfileUpdate, userUid }) => {
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'changePassword' | 'changeEmail'>('view');
  
  // ✅ ZUSTAND: Obtenemos datos del usuario y perfil
  const { user } = useAuthStore();
  const { profile, setProfile, fetchProfile } = useUserProfileStore();
  
  // Estado local del formulario (solo para edición)
  const [formData, setFormData] = useState<FormData>(() => buildFormData(user, profile));
  const [initialFormData, setInitialFormData] = useState<FormData>(() => buildFormData(user, profile));
  
  // Estados para cambio de password/email (locales, no persisten)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  const [cityOptions, setCityOptions] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // ✅ Cargar perfil de Firestore al montar (si no está en caché)
  useEffect(() => {
    if (userUid && !profile) {
      fetchProfile(userUid);
    }
  }, [userUid, profile, fetchProfile]);

  // ✅ Sincronizar formData cuando cambia el store (ej: al cargar)
  useEffect(() => {
    const data = buildFormData(user, profile);
    setFormData(data);
    setInitialFormData(data);
  }, [user, profile]);

  const fetchCities = async (query: string) => {
    if (query.trim().length < 3) {
        setCityOptions([]);
        return;
    }
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
        console.error("Error buscando ciudades:", error);
    } finally {
        setIsSearchingCity(false);
    }
  };

  const handleSaveProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !userUid) {
        setError("No se pudo verificar la sesión.");
        return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { auth: authData, profile: profileData } = separateUserData(formData);
      
      // Actualizar displayName en Auth
      const newDisplayName = `${authData.firstName} ${authData.lastName}`;
      if (currentUser.displayName !== newDisplayName) {
        await updateProfile(currentUser, { displayName: newDisplayName });
        // Actualizar el store de auth
        useAuthStore.getState().setUser({ ...currentUser, displayName: newDisplayName });
      }

      // Construir objeto para Firestore
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
        updatedAt: serverTimestamp(),
      };

      // Guardar en Firestore
      const userDocRef = doc(db, 'users', userUid);
      await setDoc(userDocRef, userProfile, { merge: true });

      // ✅ Actualizar Zustand (ya no localStorage)
      setProfile(userProfile);
      
      setInitialFormData(formData);
      setViewMode('view');
      setSuccessMessage('¡Perfil actualizado!');
      onProfileUpdate(authData.firstName);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("No se pudieron guardar los cambios.");
    } finally {
      setIsLoading(false);
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

    setIsLoading(true);
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        setSuccessMessage('¡Contraseña actualizada!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setViewMode('view'), 2000);
    } catch (err: any) {
        if (err.code === 'auth/wrong-password') setError('Contraseña actual incorrecta.');
        else setError('Error al actualizar.');
    } finally {
        setIsLoading(false);
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

    setIsLoading(true);
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, emailPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updateEmail(currentUser, normalizedNewEmail);
        
        // Actualizar email en el form local
        const updatedFormData = { ...formData, email: normalizedNewEmail };
        setFormData(updatedFormData);
        
        await sendEmailVerification(currentUser);
        setSuccessMessage('¡Correo actualizado! Verifica tu email.');
        
        setEmailPassword('');
        setNewEmail('');
        setTimeout(() => setViewMode('view'), 4000);
    } catch (err: any) {
        if (err.code === 'auth/wrong-password') setError('Contraseña incorrecta.');
        else if (err.code === 'auth/email-already-in-use') setError('Correo en uso.');
        else setError('Error al actualizar.');
    } finally {
        setIsLoading(false);
    }
  };

  const renderPhysicalData = () => {
    const parts: string[] = [];
    if (formData.weight) parts.push(`${formData.weight} kg`);
    if (formData.height) parts.push(`${formData.height} cm`);
    
    if (parts.length === 0) return null;
    
    let bmi = null;
    let bmiText = '';
    if (formData.weight && formData.height) {
      const w = parseFloat(formData.weight);
      const h = parseInt(formData.height) / 100;
      if (w > 0 && h > 0) {
        bmi = (w / (h * h)).toFixed(1);
        const bmiNum = parseFloat(bmi);
        if (bmiNum < 18.5) bmiText = 'Bajo';
        else if (bmiNum < 25) bmiText = 'Normal';
        else if (bmiNum < 30) bmiText = 'Sobrepeso';
        else bmiText = 'Obesidad';
      }
    }
    
    return (
      <InfoSection title="Datos Corporales">
        <Badge text={parts.join(' / ')} color="yellow" />
        {bmi && <Badge text={`IMC: ${bmi} (${bmiText})`} color="gray" />}
      </InfoSection>
    );
  };

  // ... (renderContent, renderViewMode, etc. permanecen igual)
  const renderContent = () => {
    switch(viewMode) {
      case 'edit':
        return (
          <div className="space-y-6 animate-fade-in pb-24">
              {error && <p className="text-red-500 text-xs text-center bg-red-50 p-3 rounded-xl">{error}</p>}
              
              <Step1 
                data={formData} 
                updateData={updateData} 
                errors={{}} 
                hidePasswordFields={true} 
                disableEmail={true}
                cityOptions={cityOptions}
                isSearchingCity={isSearchingCity}
                onSearchCity={fetchCities}
                onClearCityOptions={() => setCityOptions([])}
                onCountryChange={(code) => updateData('country', code)}
              />
              <Step2 data={formData} updateData={updateData} errors={{}} />
              <Step3 data={formData} updateData={updateData} errors={{}} />
              
              <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-bocado-border flex gap-3 z-50">
                  <button 
                    onClick={() => { 
                      setViewMode('view'); 
                      setFormData(initialFormData); 
                      setError('');
                      setCityOptions([]);
                    }} 
                    className="flex-1 py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
                    disabled={isLoading}
                  >
                      Cancelar
                  </button>
                  <button 
                    onClick={handleSaveProfile} 
                    className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray" 
                    disabled={isLoading}
                  >
                      {isLoading ? 'Guardando...' : 'Guardar'}
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
                        <label className="block text-xs font-medium text-bocado-dark-gray mb-1">Contraseña Actual</label>
                        <input 
                          type="password" 
                          value={currentPassword} 
                          onChange={(e) => setCurrentPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-bocado-dark-gray mb-1">Nueva Contraseña</label>
                        <input 
                          type="password" 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="Mínimo 8 caracteres" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-bocado-dark-gray mb-1">Confirmar</label>
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
                          disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray" 
                          disabled={isLoading}
                        >
                            {isLoading ? '...' : 'Actualizar'}
                        </button>
                    </div>
                 </form>
            </div>
          );
          
      case 'changeEmail':
          return (
            <div className="animate-fade-in">
                 <h2 className="text-lg font-bold text-bocado-dark-green mb-2">Cambiar Correo</h2>
                 <p className="text-xs text-bocado-gray mb-4">Se enviará un link de verificación.</p>
                 <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-bocado-dark-gray mb-1">Contraseña</label>
                        <input 
                          type="password" 
                          value={emailPassword} 
                          onChange={(e) => setEmailPassword(e.target.value)} 
                          className="w-full px-4 py-3 bg-bocado-background border border-bocado-border rounded-xl text-sm focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20" 
                          placeholder="••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-bocado-dark-gray mb-1">Nuevo Correo</label>
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
                          disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray" 
                          disabled={isLoading}
                        >
                            {isLoading ? '...' : 'Cambiar'}
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
                        <h3 className="font-bold text-bocado-dark-green text-xs uppercase tracking-wider">Seguridad</h3>
                    </div>
                    <div className="space-y-2">
                        <button 
                          onClick={() => setViewMode('changePassword')} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <span>Cambiar Contraseña</span>
                            <span className="text-bocado-gray">›</span>
                        </button>
                        <button 
                          onClick={() => setViewMode('changeEmail')} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-bocado-background rounded-xl text-sm font-medium text-bocado-text hover:bg-bocado-border active:scale-95 transition-all"
                        >
                            <span>Cambiar Correo</span>
                            <span className="text-bocado-gray">›</span>
                        </button>
                        {onLogout && (
                            <button 
                              onClick={onLogout} 
                              className="w-full mt-4 py-3 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors active:scale-95"
                            >
                                Cerrar Sesión
                            </button>
                        )}
                    </div>
                 </div>
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
                    <p className="text-[10px] text-bocado-gray truncate max-w-[150px]">{formData.email}</p>
                </div>
            </div>
            {viewMode === 'view' && (
                <button 
                  onClick={() => setViewMode('edit')} 
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
    </div>
  );
};

export default ProfileScreen;