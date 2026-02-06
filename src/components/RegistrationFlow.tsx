import React, { useState, useCallback, useEffect } from 'react';
import { FormData, UserProfile } from '../types';
import ProgressBar from './ProgressBar';
import Step1 from './form-steps/Step1';
import Step2 from './form-steps/Step2';
import Step3 from './form-steps/Step3';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification 
} from 'firebase/auth';
import { separateUserData } from '../utils/profileSanitizer';
import { env } from '../environment/env';

const TOTAL_STEPS = 3;

const getInitialState = (): FormData => {
  const savedData = localStorage.getItem('bocado-form');
  if (savedData) {
    const data = JSON.parse(savedData);
    return {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      gender: data.gender || '',
      age: data.age || '',
      weight: data.weight || '',
      height: data.height || '',
      country: data.country || '',
      city: data.city || '',
      email: data.email || '',
      password: '',
      confirmPassword: '',
      diseases: Array.isArray(data.diseases) ? data.diseases : [],
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      otherAllergies: data.otherAllergies || '',
      eatingHabit: data.eatingHabit || '',
      activityLevel: data.activityLevel || '',
      otherActivityLevel: data.otherActivityLevel || '',
      activityFrequency: data.activityFrequency || '',
      nutritionalGoal: Array.isArray(data.nutritionalGoal) ? data.nutritionalGoal : [],
      cookingAffinity: data.cookingAffinity || '',
      dislikedFoods: Array.isArray(data.dislikedFoods) ? data.dislikedFoods : [],
    };
  }
  return {
    firstName: '', lastName: '', gender: '', age: '', weight: '', height: '',
    country: '', city: '', email: '', password: '', confirmPassword: '', 
    diseases: [], allergies: [], otherAllergies: '', eatingHabit: '', 
    activityLevel: '', otherActivityLevel: '', activityFrequency: '',
    nutritionalGoal: [], cookingAffinity: '', dislikedFoods: [],
  };
};

interface RegistrationFlowProps {
  onRegistrationComplete: () => void;
  onGoHome: () => void;
}

const RegistrationFlow: React.FC<RegistrationFlowProps> = ({ onRegistrationComplete, onGoHome }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(getInitialState());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [cityOptions, setCityOptions] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);

  useEffect(() => {
    localStorage.setItem('bocado-form', JSON.stringify(formData));
  }, [formData]);
  
  const validateStep = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    setSubmissionError('');
    
    switch (currentStep) {
      case 1:
        if (!formData.firstName) newErrors.firstName = 'Nombre(s) es requerido';
        if (!formData.lastName) newErrors.lastName = 'Apellido(s) es requerido';
        if (!formData.gender) newErrors.gender = 'Género es requerido';
        if (!formData.age) newErrors.age = 'Edad es requerida';
        if (!formData.country) newErrors.country = 'País es requerido';
        if (!formData.city) newErrors.city = 'Ciudad es requerida';
        if (!formData.email) newErrors.email = 'Email es requerido';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email no es válido';
        if (!formData.password) newErrors.password = 'Contraseña es requerida';
        else if (formData.password.length < 8) newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
        if (!formData.confirmPassword) newErrors.confirmPassword = 'Confirmar contraseña es requerido';
        else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden.';
        break;
        
      case 2:
        if (formData.allergies.includes('Otro') && !formData.otherAllergies.trim()) {
          newErrors.otherAllergies = 'Por favor, especifica tus otras alergias.';
        }
        if (formData.nutritionalGoal.length === 0) {
          newErrors.nutritionalGoal = 'Debes seleccionar al menos un objetivo nutricional.';
        }
        break;
        
      case 3:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmissionError('');

    try {
      const { auth: authData, profile } = separateUserData(formData);
      
      // 1. Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        authData.email,
        authData.password!
      );
      const user = userCredential.user;

      // 2. Actualizar displayName en Auth
      const displayName = `${authData.firstName} ${authData.lastName}`;
      await updateProfile(user, { displayName });

      // 3. Preparar datos de perfil para Firestore
      const userProfile: UserProfile = {
        uid: user.uid,
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
        activityLevel: profile.activityLevel,
        otherActivityLevel: profile.otherActivityLevel,
        activityFrequency: profile.activityFrequency,
        nutritionalGoal: profile.nutritionalGoal,
        cookingAffinity: profile.cookingAffinity,
        dislikedFoods: profile.dislikedFoods,
        emailVerified: false, // <-- NUEVO: marca como no verificado
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 4. Guardar perfil en Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, userProfile);

      // 5. ENVIAR CORREO DE VERIFICACIÓN <-- NUEVO
      await sendEmailVerification(user);
      
      // 6. Guardar en localStorage y mostrar modal
      const fullProfileData = {
        ...userProfile,
        firstName: authData.firstName,
        lastName: authData.lastName,
        email: authData.email,
      };
      
      localStorage.setItem('bocado-profile-data', JSON.stringify(fullProfileData));
      localStorage.removeItem('bocado-form');
      
      setRegisteredEmail(authData.email);
      setShowVerificationModal(true); // <-- NUEVO: mostrar modal en lugar de completar

    } catch (error: any) {
      console.error("Error en registro:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        setSubmissionError("Este correo electrónico ya está registrado.");
        setCurrentStep(1);
      } else if (error.code === 'auth/weak-password') {
        setSubmissionError("La contraseña es muy débil. Usa al menos 8 caracteres.");
      } else if (error.code === 'auth/invalid-email') {
        setSubmissionError("El formato del correo no es válido.");
      } else {
        setSubmissionError("No se pudo crear la cuenta. Por favor, inténtalo de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    setShowVerificationModal(false);
    onRegistrationComplete();
  };

  const nextStep = async () => {
    if (await validateStep()) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      } else {
        await handleSubmit();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setSubmissionError('');
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchCity = async (query: string) => {
    if (!formData.country || query.length < 3) {
      setCityOptions([]);
      return;
    }
    setIsSearchingCity(true);
    try {
      const username = env.api.geonamesUsername;
      const response = await fetch(
        `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(query)}&country=${formData.country}&maxRows=10&username=${username}&lang=es`
      );
      const data = await response.json();
      setCityOptions(data.geonames || []);
    } catch (error) {
      console.error('Error buscando ciudades:', error);
      setCityOptions([]);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleClearCityOptions = () => {
    setCityOptions([]);
  };

  const handleCountryChange = (code: string, name: string) => {
    updateFormData('country', code);
    updateFormData('city', '');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1 
            data={formData} 
            updateData={updateFormData} 
            errors={errors}
            cityOptions={cityOptions}
            isSearchingCity={isSearchingCity}
            onSearchCity={handleSearchCity}
            onClearCityOptions={handleClearCityOptions}
            onCountryChange={handleCountryChange}
          />
        );
      case 2:
        return <Step2 data={formData} updateData={updateFormData} errors={errors} />;
      case 3:
        return <Step3 data={formData} updateData={updateFormData} errors={errors} />;
      default:
        return null;
    }
  };

  // MODAL DE VERIFICACIÓN DE CORREO <-- NUEVO COMPONENTE
  if (showVerificationModal) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md text-center animate-fade-in">
        <div className="w-16 h-16 bg-bocado-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-bocado-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-bocado-dark-green mb-2">¡Verifica tu correo!</h2>
        <p className="text-gray-600 mb-4">
          Hemos enviado un enlace de verificación a <strong>{registeredEmail}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Por favor, revisa tu bandeja de entrada (y spam) y haz clic en el enlace para activar tu cuenta.
        </p>
        <button
          onClick={handleVerificationComplete}
          className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-bocado-green-light transition-colors"
        >
          Ya verifiqué mi correo
        </button>
        <p className="text-xs text-gray-400 mt-4">
          ¿No recibiste el correo? Revisa tu carpeta de spam o contacta soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full transition-all duration-500">
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      <div className="mt-8">
        {renderStep()}
        {submissionError && <p className="text-red-500 text-sm mt-4 text-center">{submissionError}</p>}
      </div>
      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={prevStep}
          className={`px-6 py-2 rounded-full font-semibold transition-opacity ${currentStep === 1 ? 'opacity-0 cursor-default' : 'opacity-100 bg-gray-200 text-bocado-dark-gray hover:bg-gray-300'}`}
          disabled={currentStep === 1 || isLoading}
        >
          Anterior
        </button>
        <button
          onClick={nextStep}
          className="bg-bocado-green text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-bocado-green-light transition-colors duration-300 disabled:bg-gray-400"
          disabled={isLoading}
        >
          {isLoading ? 'Finalizando...' : (currentStep === TOTAL_STEPS ? 'Finalizar' : 'Siguiente')}
        </button>
      </div>
      <div className="mt-6 text-center">
        <button onClick={onGoHome} className="text-sm text-bocado-green font-semibold hover:underline" disabled={isLoading}>
            Volver al inicio
        </button>
      </div>
    </div>
  );
};

export default RegistrationFlow;