
import React, { useState, useEffect } from 'react';
import { FormData } from '../types';
import { UserIcon } from './icons/UserIcon';
import { LockIcon } from './icons/LockIcon';
import Step1 from './form-steps/Step1';
import Step3 from './form-steps/Step3';
import Step4 from './form-steps/Step4';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { sanitizeProfileData } from '../utils/profileSanitizer';

const stripEmoji = (str: string) => {
    if (!str) return str;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    const parts = str.split(' ');
    if (parts.length > 0 && emojiRegex.test(parts[0])) {
        return parts.slice(1).join(' ');
    }
    return str;
};

interface ProfileScreenProps {
  onLogout?: () => void;
  onProfileUpdate: (newFirstName: string) => void;
  userUid: string;
}

const getProfileDataFromStorage = (): FormData => {
  const savedData = localStorage.getItem('bocado-profile-data');
  const parsedData = savedData ? JSON.parse(savedData) : {};
  return sanitizeProfileData(parsedData); // Siempre sanitizar
};

// Helper components for displaying profile info
const InfoSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
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
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    const data = getProfileDataFromStorage();
    setFormData(data);
    setInitialFormData(data);
  }, []);

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!formData || !user || !userUid) { // Ensure userUid is available
        setError("No se pudo verificar la sesión de usuario.");
        return;
    }
    setIsLoading(true);
    setError('');
    try {
      const {
        firstName,
        lastName,
        ...rest
      } = formData;

      const dataToSaveInFirestore = {
        ...rest,
        activityLevel: stripEmoji(formData.activityLevel),
      };

      // 1. Update Firestore document (using the userUid prop)
      const userDocRef = doc(db, 'users', userUid);
      await setDoc(userDocRef, dataToSaveInFirestore, { merge: true });

      // 2. Update Auth displayName
      const newDisplayName = `${formData.firstName} ${formData.lastName}`;
      if (user.displayName !== newDisplayName) {
        await updateProfile(user, { displayName: newDisplayName });
      }

      // 3. Update local storage and state
      localStorage.setItem('bocado-profile-data', JSON.stringify(formData));
      setInitialFormData(formData);
      setViewMode('view');
      setSuccessMessage('¡Perfil actualizado con éxito!');
      onProfileUpdate(formData.firstName);
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (err) {
      console.error("Error updating profile:", err);
      setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateData = (field: keyof FormData, value: any) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : getProfileDataFromStorage());
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
        setError('La nueva contraseña no coincide con la confirmación.');
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
        setTimeout(() => setViewMode('view'), 2000);
    } catch (err: any) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('La contraseña actual es incorrecta.');
        else setError('Error al actualizar la contraseña. Inténtalo de nuevo.');
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
    
    const user = auth.currentUser;
    if (!user || !user.email || !userUid) { // Ensure userUid is available
        setError('No hay una sesión activa.');
        return;
    }

    const oldEmail = user.email.toLowerCase();
    const normalizedNewEmail = newEmail.toLowerCase();
    if (oldEmail === normalizedNewEmail) {
        setError('El nuevo correo es igual al actual.');
        return;
    }

    setIsLoading(true);
    try {
        const credential = EmailAuthProvider.credential(user.email, emailPassword);
        await reauthenticateWithCredential(user, credential);
        
        const batch = writeBatch(db);
        
        // Update the user's main profile doc with the new email (using the userUid prop)
        const userDocRef = doc(db, 'users', userUid);
        batch.update(userDocRef, { email: normalizedNewEmail });
        
        await updateEmail(user, normalizedNewEmail);
        
        await batch.commit();
        
        const updatedFormData = { ...formData!, email: normalizedNewEmail };
        setFormData(updatedFormData);
        localStorage.setItem('bocado-profile-data', JSON.stringify(updatedFormData));
        
        await sendEmailVerification(user);
        setSuccessMessage('¡Correo actualizado! Te hemos enviado un link de verificación.');
        setTimeout(() => setViewMode('view'), 4000);

    } catch (err: any) {
        if (err.code === 'auth/wrong-password') setError('La contraseña es incorrecta.');
        else if (err.code === 'auth/email-already-in-use') setError('Este correo ya está en uso por otra cuenta.');
        else setError('Error al actualizar el correo.');
    } finally {
        setIsLoading(false);
    }
  };


  if (!formData) {
    return (
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-red-500">Error</h2>
        <p className="mt-4 text-bocado-dark-gray">No se encontraron datos del perfil.</p>
      </div>
    );
  }

  const renderContent = () => {
    switch(viewMode) {
      case 'edit':
        return (
          <div className="mt-4 space-y-8 animate-fade-in">
              <Step1 data={formData} updateData={updateData} errors={{}} hidePasswordFields={true} disableEmail={true} />
              <Step3 data={formData} updateData={updateData} errors={{}} />
              <Step4 data={formData} updateData={updateData} errors={{}} />
              {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
              <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-gray-200 flex justify-end items-center gap-4 z-10">
                  <button onClick={() => { setViewMode('view'); setFormData(initialFormData); setError(''); }} className="px-6 py-2 rounded-full font-semibold bg-gray-200 text-bocado-dark-gray hover:bg-gray-300" disabled={isLoading}>
                      Cancelar
                  </button>
                  <button onClick={handleSaveProfile} className="bg-bocado-green text-white font-bold py-2 px-8 rounded-full shadow-md hover:bg-bocado-green-light disabled:bg-gray-400" disabled={isLoading}>
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
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" placeholder="••••••••••" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" placeholder="Mínimo 10 caracteres" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nueva Contraseña</label>
                        <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-bocado-green focus:border-bocado-green" placeholder="••••••••••" />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                    {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{successMessage}</p>}
                    <div className="flex justify-end items-center gap-4 mt-8">
                        <button type="button" onClick={() => setViewMode('view')} className="px-6 py-2 rounded-full font-semibold bg-gray-200 text-bocado-dark-gray hover:bg-gray-300" disabled={isLoading}>
                            Cancelar
                        </button>
                        <button type="submit" className="bg-bocado-green text-white font-bold py-2 px-8 rounded-full shadow-md hover:bg-bocado-green-light disabled:bg-gray-400" disabled={isLoading}>
                            {isLoading ? 'Actualizando...' : 'Actualizar'}
                        </button>
                    </div>
                 </form>
            </div>
          );
      case 'changeEmail':
          return (
            <div className="mt-4 animate-fade-in">
                 <h2 className="text-lg font-bold text-bocado-dark-green mb-4">Cambiar Correo</h2>
                 <p className="text-sm text-gray-500 mb-6">Confirma tu contraseña. Se enviará un link de verificación a tu nuevo correo.</p>
                 <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                        <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="••••••••••" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Correo</label>
                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="nuevo@correo.com" />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                    {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{successMessage}</p>}
                    <div className="flex justify-end items-center gap-4 mt-8">
                        <button type="button" onClick={() => setViewMode('view')} className="px-6 py-2 rounded-full font-semibold bg-gray-200 text-bocado-dark-gray hover:bg-gray-300" disabled={isLoading}>
                            Cancelar
                        </button>
                        <button type="submit" className="bg-bocado-green text-white font-bold py-2 px-8 rounded-full shadow-md hover:bg-bocado-green-light disabled:bg-gray-400" disabled={isLoading}>
                            {isLoading ? 'Procesando...' : 'Cambiar'}
                        </button>
                    </div>
                 </form>
            </div>
          );
      case 'view':
      default:
        return (
             <div className="space-y-6">
                 {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded mb-4 animate-fade-in">{successMessage}</p>}
                 
                 <div className="space-y-4">
                    <InfoSection title="Información Personal">
                        {formData.gender && <Badge text={formData.gender} color="gray" />}
                        {formData.age && <Badge text={`${formData.age} años`} color="gray" />}
                        {formData.city && formData.country && <Badge text={`${formData.city}, ${formData.country}`} color="gray" />}
                        {formData.cookingAffinity && <Badge text={`Le gusta cocinar: ${formData.cookingAffinity}`} color="gray" />}
                    </InfoSection>

                    <InfoSection title="Objetivo(s) Nutricional(es)">
                        {formData.nutritionalGoal.length > 0 ? formData.nutritionalGoal.map(g => <Badge key={g} text={g} color="green" />) : <p className="text-sm text-gray-500">No especificado</p>}
                    </InfoSection>

                    <InfoSection title="Actividad Física">
                        {formData.activityLevel ? <Badge text={`${stripEmoji(formData.activityLevel)} (${formData.activityFrequency || 'N/A'})`} color="gray" /> : <p className="text-sm text-gray-500">No especificado</p>}
                    </InfoSection>

                     <InfoSection title="Alergias y Preferencias">
                        {formData.allergies.length > 0 || formData.otherAllergies ? (
                            <>
                                {formData.allergies.map(a => <Badge key={a} text={a} color="blue" />)}
                                {formData.otherAllergies && <Badge text={formData.otherAllergies} color="blue" />}
                            </>
                        ) : <p className="text-sm text-gray-500">Ninguna</p>}
                    </InfoSection>

                     <InfoSection title="Ingredientes a Evitar">
                        {formData.dislikedFoods.length > 0 ? formData.dislikedFoods.map(f => <Badge key={f} text={f} color="red" />) : <p className="text-sm text-gray-500">Ninguno</p>}
                    </InfoSection>
                 </div>

                 <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                        <LockIcon className="w-5 h-5 text-bocado-dark-gray" />
                        <h3 className="font-bold text-bocado-dark-green text-sm">Seguridad de la Cuenta</h3>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => setViewMode('changePassword')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors border border-gray-100">
                            <span>Cambiar Contraseña</span>
                            <span className="text-gray-400">›</span>
                        </button>
                        <button onClick={() => setViewMode('changeEmail')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors border border-gray-100">
                            <span>Cambiar Correo Electrónico</span>
                            <span className="text-gray-400">›</span>
                        </button>
                        {onLogout && (
                            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-white text-red-500 border border-red-200 font-bold py-3 px-6 rounded-lg hover:bg-red-50 transition-colors mt-4">
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
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full animate-fade-in mb-8">
        <div className="border-b border-gray-100 pb-4 mb-6">
            <div className="flex justify-between items-start">
                 <div className="flex items-center gap-3">
                    <div className="bg-bocado-green/10 p-2 rounded-full">
                        <UserIcon className="w-6 h-6 text-bocado-green"/>
                    </div>
                    <h1 className="text-2xl font-bold text-bocado-dark-green">Mi Perfil</h1>
                </div>
                {viewMode === 'view' && (
                     <button onClick={() => setViewMode('edit')} className="text-sm text-bocado-green font-bold hover:underline px-2 py-1">
                        Editar Perfil
                    </button>
                )}
            </div>

            {viewMode === 'view' && (
                <div className="mt-4 pl-1">
                    <p className="font-bold text-bocado-dark-green text-lg">{auth.currentUser?.displayName || `${formData.firstName} ${formData.lastName}`}</p>
                    <p className="text-xs text-bocado-gray">{formData.email}</p>
                </div>
            )}
        </div>
      
      {renderContent()}
    </div>
  );
};

export default ProfileScreen;
