import React, { useState, useEffect } from 'react';
import { FormData } from '../types';
import { UserIcon } from './icons/UserIcon';
import { LockIcon } from './icons/LockIcon';
import Step1 from './form-steps/Step1';
import Step2 from './form-steps/Step2';
import Step4 from './form-steps/Step3';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updateEmail, 
  sendEmailVerification, 
  updateProfile 
} from 'firebase/auth';
import { sanitizeProfileData } from '../utils/profileSanitizer';
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
  return sanitizeProfileData(parsedData);
};

const InfoSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex flex-wrap gap-2">{children}</div>
    </div>
);

const Badge: React.FC<{ text: string; color: 'green' | 'blue' | 'red' | 'gray' }> = ({ text, color }) => {
    const colors = {
        green: 'bg-green-100 text-green-800',
        blue: 'bg-blue-100 text-blue-800',
        red: 'bg-red-100 text-red-800',
        gray: 'bg-gray-100 text-gray-800',
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
            `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(query)}&country=${countryCode}&maxRows=10&username=${username}`
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
    const user = auth.currentUser;
    if (!formData || !user || !userUid) {
        setError("No se pudo verificar la sesión de usuario.");
        return;
    }
    setIsLoading(true);
    setError('');
    try {
      const dataToSave = {
        ...formData,
        activityLevel: stripEmoji(formData.activityLevel),
        country: formData.country.toUpperCase() // Asegurar ISO de 2 letras
      };

      const userDocRef = doc(db, 'users', userUid);
      await setDoc(userDocRef, dataToSave, { merge: true });

      const newDisplayName = `${formData.firstName} ${formData.lastName}`;
      await updateProfile(user, { displayName: newDisplayName });

      localStorage.setItem('bocado-profile-data', JSON.stringify(dataToSave));
      setInitialFormData(dataToSave);
      setViewMode('view');
      setSuccessMessage('¡Perfil actualizado con éxito!');
      onProfileUpdate(formData.firstName);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
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
    setIsLoading(true);
    setError('');
    try {
        const user = auth.currentUser;
        if (!user?.email) throw new Error();
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setSuccessMessage('Contraseña actualizada.');
        setTimeout(() => setViewMode('view'), 2000);
    } catch (err) {
        setError('Error al actualizar contraseña. Verifica tus datos.');
    } finally {
        setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch(viewMode) {
      case 'edit':
        return (
          <div className="mt-4 space-y-8 animate-fade-in pb-20">
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
              />
              <Step2 data={formData} updateData={updateData} errors={{}} />
              <Step4 data={formData} updateData={updateData} errors={{}} />
              
              <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100 flex justify-end gap-3 z-50 shadow-2xl">
                  <button onClick={() => { setViewMode('view'); setFormData(initialFormData); }} className="px-6 py-2 rounded-xl font-bold bg-gray-100 text-gray-500">
                      Cancelar
                  </button>
                  <button onClick={handleSaveProfile} className="bg-bocado-green text-white font-bold py-2 px-8 rounded-xl shadow-lg" disabled={isLoading}>
                      {isLoading ? 'Guardando...' : 'Guardar'}
                  </button>
              </div>
          </div>
        );
      case 'view':
      default:
        return (
             <div className="space-y-6">
                 {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-xl animate-fade-in font-medium">{successMessage}</p>}
                 
                 <div className="space-y-4">
                    <InfoSection title="Información Personal">
                        <Badge text={formData.gender} color="gray" />
                        <Badge text={`${formData.age} años`} color="gray" />
                        <Badge text={`${formData.city}, ${formData.country}`} color="gray" />
                        <Badge text={`Cocina: ${formData.cookingAffinity}`} color="gray" />
                    </InfoSection>

                    <InfoSection title="Salud y Objetivos">
                        {formData.nutritionalGoal.map(g => <Badge key={g} text={g} color="green" />)}
                        {formData.diseases?.map(d => <Badge key={d} text={d} color="red" />)}
                    </InfoSection>

                     <InfoSection title="Alergias y Preferencias">
                        {formData.allergies.map(a => <Badge key={a} text={a} color="blue" />)}
                        {formData.dislikedFoods.map(f => <Badge key={f} text={f} color="red" />)}
                    </InfoSection>
                 </div>

                 <div className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="font-bold text-bocado-dark-green text-sm mb-4">Seguridad</h3>
                    <div className="space-y-2">
                        <button onClick={() => setViewMode('changePassword')} className="w-full flex justify-between p-4 bg-gray-50 rounded-xl text-sm font-medium">
                            <span>Cambiar Contraseña</span>
                            <span>›</span>
                        </button>
                        <button onClick={onLogout} className="w-full p-4 text-red-500 font-bold text-sm">
                            Cerrar Sesión
                        </button>
                    </div>
                 </div>
            </div>
        );
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm w-full animate-fade-in max-w-2xl mx-auto">
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
                <button onClick={() => setViewMode('edit')} className="text-sm bg-bocado-green/10 text-bocado-green font-bold px-4 py-2 rounded-full">
                    Editar
                </button>
            )}
        </div>
      {renderContent()}
    </div>
  );
};

export default ProfileScreen;