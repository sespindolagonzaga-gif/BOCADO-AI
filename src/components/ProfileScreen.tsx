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

const getProfileDataFromStorage = (): FormData => {
  const savedData = localStorage.getItem('bocado-profile-data');
  const parsedData = savedData ? JSON.parse(savedData) : {};
  return {
    ...sanitizeProfileData(parsedData),
    firstName: parsedData.firstName || '',
    lastName: parsedData.lastName || '',
    email: parsedData.email || '',
  } as FormData;
};

const InfoSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex flex-wrap gap-2">{children}</div>
    </div>
);

const Badge: React.FC<{ text: string; color: 'green' | 'blue' | 'red' | 'gray' | 'yellow' }> = ({ text, color }) => {
    const colors = {
        green: 'bg-green-100 text-green-800',
        blue: 'bg-blue-100 text-blue-800',
        red: 'bg-red-100 text-red-800',
        gray: 'bg-gray-100 text-gray-800',
        yellow: 'bg-yellow-100 text-yellow-800',
    };
    return <span className={`px-2.5 py-1 text-sm font-medium rounded-full ${colors[color]}`}>{text}</span>;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, onProfileUpdate, userUid }) => {
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'changePassword' | 'changeEmail'>('view');
  const [formData, setFormData] = useState<FormData>(getProfileDataFromStorage());
  const [initialFormData, setInitialFormData] = useState<FormData>(getProfileDataFromStorage());
  
  // Estados para cambios de seguridad
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  // Estados para búsqueda de ciudades
  const [cityOptions, setCityOptions] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    const data = getProfileDataFromStorage();
    setFormData(data);
    setInitialFormData(data);
  }, []);

  // --- LÓGICA DE BÚSQUEDA GEONAMES ---
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

  // --- GUARDAR PERFIL (solo datos no sensibles a Firestore) ---
  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user || !userUid) {
        setError("No se pudo verificar la sesión de usuario.");
        return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Separar datos: auth (sensibles) vs perfil (Firestore)
      const { auth: authData, profile } = separateUserData(formData);
      
      // 2. Actualizar displayName en Auth si cambió el nombre
      const newDisplayName = `${authData.firstName} ${authData.lastName}`;
      if (user.displayName !== newDisplayName) {
        await updateProfile(user, { displayName: newDisplayName });
      }

      // 3. Preparar datos de perfil para Firestore (SIN email, SIN nombres, SIN password)
      const userProfile: UserProfile = {
        uid: userUid,
        gender: profile.gender,
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        country: profile.country.toUpperCase(),
        city: profile.city,
        diseases: profile.diseases,
        allergies: profile.allergies,
        otherAllergies: profile.otherAllergies,
        eatingHabit: profile.eatingHabit,
        activityLevel: stripEmoji(profile.activityLevel),
        otherActivityLevel: profile.otherActivityLevel,
        activityFrequency: profile.activityFrequency,
        nutritionalGoal: profile.nutritionalGoal,
        cookingAffinity: profile.cookingAffinity,
        dislikedFoods: profile.dislikedFoods,
        updatedAt: serverTimestamp(),
      };

      // 4. Guardar SOLO perfil en Firestore
      const userDocRef = doc(db, 'users', userUid);
      await setDoc(userDocRef, userProfile, { merge: true });

      // 5. Actualizar localStorage con datos completos (para UI)
      const fullProfileData = {
        ...userProfile,
        firstName: authData.firstName,
        lastName: authData.lastName,
        email: authData.email,
      };
      
      localStorage.setItem('bocado-profile-data', JSON.stringify(fullProfileData));
      setInitialFormData(formData);
      setViewMode('view');
      setSuccessMessage('¡Perfil actualizado con éxito!');
      onProfileUpdate(authData.firstName);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- CAMBIAR CONTRASEÑA ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        setError('Todos los campos son obligatorios.');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        setError('La nueva contraseña no coincide con la confirmación.');
        return;
    }
    if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
        setError('No hay una sesión activa. Por favor, vuelve a iniciar sesión.');
        return;
    }

    setIsLoading(true);
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        
        setSuccessMessage('¡Contraseña actualizada correctamente!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setViewMode('view'), 2000);
    } catch (err: any) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            setError('La contraseña actual es incorrecta.');
        } else {
            setError('Error al actualizar la contraseña. Inténtalo de nuevo.');
        }
    } finally {
        setIsLoading(false);
    }
  };
  
  // --- CAMBIAR EMAIL ---
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!emailPassword || !newEmail) {
        setError('Todos los campos son obligatorios.');
        return;
    }
    
    const user = auth.currentUser;
    if (!user || !user.email || !userUid) {
        setError('No hay una sesión activa.');
        return;
    }

    const oldEmail = user.email.toLowerCase();
    const normalizedNewEmail = newEmail.toLowerCase().trim();
    
    if (oldEmail === normalizedNewEmail) {
        setError('El nuevo correo es igual al actual.');
        return;
    }
    
    if (!/\S+@\S+\.\S+/.test(normalizedNewEmail)) {
        setError('El formato del correo no es válido.');
        return;
    }

    setIsLoading(true);
    try {
        // 1. Reautenticar
        const credential = EmailAuthProvider.credential(user.email, emailPassword);
        await reauthenticateWithCredential(user, credential);
        
        // 2. Actualizar email en Auth
        await updateEmail(user, normalizedNewEmail);
        
        // 3. Actualizar localStorage
        const updatedFormData = { ...formData, email: normalizedNewEmail };
        setFormData(updatedFormData);
        localStorage.setItem('bocado-profile-data', JSON.stringify(updatedFormData));
        
        // 4. Enviar verificación
        await sendEmailVerification(user);
        setSuccessMessage('¡Correo actualizado! Te hemos enviado un link de verificación.');
        
        setEmailPassword('');
        setNewEmail('');
        setTimeout(() => setViewMode('view'), 4000);

    } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/wrong-password') setError('La contraseña es incorrecta.');
        else if (err.code === 'auth/email-already-in-use') setError('Este correo ya está en uso por otra cuenta.');
        else if (err.code === 'auth/invalid-email') setError('El formato del correo no es válido.');
        else if (err.code === 'auth/requires-recent-login') setError('Por seguridad, cierra sesión y vuelve a iniciar sesión antes de cambiar el email.');
        else setError('Error al actualizar el correo. Inténtalo más tarde.');
    } finally {
        setIsLoading(false);
    }
  };

  // --- MOSTRAR DATOS CORPORALES ---
  const renderPhysicalData = () => {
    const parts: string[] = [];
    if (formData.weight) parts.push(`${formData.weight} kg`);
    if (formData.height) parts.push(`${formData.height} cm`);
    
    if (parts.length === 0) return null;
    
    // Calcular IMC
    let bmi = null;
    let bmiText = '';
    if (formData.weight && formData.height) {
      const w = parseFloat(formData.weight);
      const h = parseInt(formData.height) / 100;
      if (w > 0 && h > 0) {
        bmi = (w / (h * h)).toFixed(1);
        const bmiNum = parseFloat(bmi);
        if (bmiNum < 18.5) bmiText = ' (Bajo peso)';
        else if (bmiNum < 25) bmiText = ' (Normal)';
        else if (bmiNum < 30) bmiText = ' (Sobrepeso)';
        else bmiText = ' (Obesidad)';
      }
    }
    
    return (
      <InfoSection title="Datos Corporales">
        <Badge text={parts.join(' / ')} color="yellow" />
        {bmi && <Badge text={`IMC: ${bmi}${bmiText}`} color="gray" />}
      </InfoSection>
    );
  };

  const renderContent = () => {
    switch(viewMode) {
      case 'edit':
        return (
          <div className="mt-4 space-y-8 animate-fade-in pb-24">
              {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}
              
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
              
              <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100 flex justify-end gap-3 z-50 shadow-2xl">
                  <button 
                    onClick={() => { 
                      setViewMode('view'); 
                      setFormData(initialFormData); 
                      setError('');
                      setCityOptions([]);
                    }} 
                    className="px-6 py-2 rounded-xl font-bold bg-gray-100 text-gray-500 hover:bg-gray-200"
                    disabled={isLoading}
                  >
                      Cancelar
                  </button>
                  <button 
                    onClick={handleSaveProfile} 
                    className="bg-bocado-green text-white font-bold py-2 px-8 rounded-xl shadow-lg hover:bg-bocado-green-light disabled:bg-gray-400" 
                    disabled={isLoading}
                  >
                      {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
              </div>
          </div>
        );
        
      case 'changePassword':
         return (
            <div className="mt-4 animate-fade-in">
                 <h2 className="text-lg font-bold text-bocado-dark-green mb-4">Cambiar Contraseña</h2>
                 <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                        <input 
                          type="password" 
                          value={currentPassword} 
                          onChange={(e) => setCurrentPassword(e.target.value)} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" 
                          placeholder="••••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                        <input 
                          type="password" 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" 
                          placeholder="Mínimo 8 caracteres" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
                        <input 
                          type="password" 
                          value={confirmNewPassword} 
                          onChange={(e) => setConfirmNewPassword(e.target.value)} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" 
                          placeholder="••••••••••" 
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                    {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{successMessage}</p>}
                    <div className="flex justify-end items-center gap-4 mt-8">
                        <button 
                          type="button" 
                          onClick={() => {
                            setViewMode('view');
                            setError('');
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                          }} 
                          className="px-6 py-2 rounded-full font-semibold bg-gray-200 text-bocado-dark-gray hover:bg-gray-300" 
                          disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="bg-bocado-green text-white font-bold py-2 px-8 rounded-full shadow-md hover:bg-bocado-green-light disabled:bg-gray-400" 
                          disabled={isLoading}
                        >
                            {isLoading ? 'Actualizando...' : 'Actualizar'}
                        </button>
                    </div>
                 </form>
            </div>
          );
          
      case 'changeEmail':
          return (
            <div className="mt-4 animate-fade-in">
                 <h2 className="text-lg font-bold text-bocado-dark-green mb-4">Cambiar Correo Electrónico</h2>
                 <p className="text-sm text-gray-500 mb-6">Confirma tu contraseña actual. Se enviará un link de verificación a tu nuevo correo.</p>
                 <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                        <input 
                          type="password" 
                          value={emailPassword} 
                          onChange={(e) => setEmailPassword(e.target.value)} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" 
                          placeholder="••••••••••" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Correo Electrónico</label>
                        <input 
                          type="email" 
                          value={newEmail} 
                          onChange={(e) => setNewEmail(e.target.value)} 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" 
                          placeholder="nuevo@correo.com" 
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                    {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{successMessage}</p>}
                    <div className="flex justify-end items-center gap-4 mt-8">
                        <button 
                          type="button" 
                          onClick={() => {
                            setViewMode('view');
                            setError('');
                            setEmailPassword('');
                            setNewEmail('');
                          }} 
                          className="px-6 py-2 rounded-full font-semibold bg-gray-200 text-bocado-dark-gray hover:bg-gray-300" 
                          disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="bg-bocado-green text-white font-bold py-2 px-8 rounded-full shadow-md hover:bg-bocado-green-light disabled:bg-gray-400" 
                          disabled={isLoading}
                        >
                            {isLoading ? 'Procesando...' : 'Cambiar Correo'}
                        </button>
                    </div>
                 </form>
            </div>
          );
          
      case 'view':
      default:
        return (
             <div className="space-y-6">
                 {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-xl animate-fade-in font-medium">{successMessage}</p>}
                 
                 <div className="space-y-4">
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

                    {/* DATOS CORPORALES */}
                    {renderPhysicalData()}

                    <InfoSection title="Objetivo(s) Nutricional(es)">
                        {formData.nutritionalGoal.length > 0 && formData.nutritionalGoal[0] !== 'Sin especificar' 
                          ? formData.nutritionalGoal.map(g => <Badge key={g} text={g} color="green" />) 
                          : <span className="text-sm text-gray-400">No especificado</span>
                        }
                    </InfoSection>

                    <InfoSection title="Actividad Física">
                        {formData.activityLevel ? (
                          <Badge 
                            text={`${stripEmoji(formData.activityLevel)}${formData.activityFrequency ? ` (${formData.activityFrequency})` : ''}`} 
                            color="gray" 
                          />
                        ) : (
                          <span className="text-sm text-gray-400">No especificado</span>
                        )}
                    </InfoSection>

                    <InfoSection title="Salud">
                        {formData.diseases.length > 0 && formData.diseases[0] !== 'Ninguna' 
                          ? formData.diseases.map(d => <Badge key={d} text={d} color="red" />) 
                          : <span className="text-sm text-gray-400">Sin condiciones crónicas</span>
                        }
                    </InfoSection>

                     <InfoSection title="Alergias y Restricciones">
                        {formData.allergies.length > 0 && formData.allergies[0] !== 'Ninguna' ? (
                            <>
                                {formData.allergies.map(a => <Badge key={a} text={a} color="blue" />)}
                                {formData.otherAllergies && <Badge text={formData.otherAllergies} color="blue" />}
                            </>
                        ) : (
                            <span className="text-sm text-gray-400">Ninguna</span>
                        )}
                    </InfoSection>

                     <InfoSection title="Ingredientes a Evitar">
                        {formData.dislikedFoods.length > 0 && formData.dislikedFoods[0] !== 'Ninguno' 
                          ? formData.dislikedFoods.map(f => <Badge key={f} text={f} color="red" />) 
                          : <span className="text-sm text-gray-400">Ninguno</span>
                        }
                    </InfoSection>
                 </div>

                 <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <LockIcon className="w-5 h-5 text-bocado-dark-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-sm">Seguridad de la Cuenta</h3>
                    </div>
                    <div className="space-y-3">
                        <button 
                          onClick={() => setViewMode('changePassword')} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
                        >
                            <span>Cambiar Contraseña</span>
                            <span className="text-gray-400">›</span>
                        </button>
                        <button 
                          onClick={() => setViewMode('changeEmail')} 
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
                        >
                            <span>Cambiar Correo Electrónico</span>
                            <span className="text-gray-400">›</span>
                        </button>
                        {onLogout && (
                            <button 
                              onClick={onLogout} 
                              className="w-full mt-4 p-4 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors"
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
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm w-full animate-fade-in max-w-2xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
                <div className="bg-bocado-green/10 p-2 rounded-full">
                    <UserIcon className="w-6 h-6 text-bocado-green"/>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-bocado-dark-green">Mi Perfil</h1>
                    <p className="text-xs text-gray-400">{formData.email}</p>
                </div>
            </div>
            {viewMode === 'view' && (
                <button 
                  onClick={() => setViewMode('edit')} 
                  className="text-sm bg-bocado-green/10 text-bocado-green font-bold px-4 py-2 rounded-full hover:bg-bocado-green/20 transition-colors"
                >
                    Editar
                </button>
            )}
        </div>
      {renderContent()}
    </div>
  );
};

export default ProfileScreen;