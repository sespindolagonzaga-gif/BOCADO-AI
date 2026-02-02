
import React, { useState, useCallback, useEffect } from 'react';
import { FormData } from '../types';
import ProgressBar from './ProgressBar';
import Step1 from './form-steps/Step1';
import Step3 from './form-steps/Step3';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { sanitizeProfileData } from '../utils/profileSanitizer';

const TOTAL_STEPS = 2;

const getInitialState = (): FormData => {
  const savedData = localStorage.getItem('bocado-form');
  if (savedData) {
    const data = JSON.parse(savedData);
    return {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      gender: data.gender || '',
      age: data.age || '',
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
    firstName: '', lastName: '', gender: '', age: '', country: '', city: '', email: '',
    password: '', confirmPassword: '', diseases: [], allergies: [], otherAllergies: '',
    eatingHabit: '', activityLevel: '', otherActivityLevel: '', activityFrequency: '',
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
        if (!formData.cookingAffinity) newErrors.cookingAffinity = 'Este campo es requerido.';
        break;
      case 2:
        if (formData.allergies.includes('Otro') && !formData.otherAllergies.trim()) newErrors.otherAllergies = 'Por favor, especifica tus otras alergias.';
        if (formData.nutritionalGoal.length === 0) newErrors.nutritionalGoal = 'Debes seleccionar al menos un objetivo.';
        break;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmissionError('');
  
    try {
      // PASO 1: Petición estándar a la Cloud Function con CORS habilitado
      const response = await fetch("https://registerusersecurely-iuou7tzsqq-uc.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error desconocido del servidor");
      }
  
      // PASO 2: Inicio de sesión inmediato y sin reintentos
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password!);
      const user = userCredential.user;
  
      // PASO 3: Obtener perfil, combinar con `displayName` y guardar
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
  
      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        const displayName = user.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
  
        const combinedData = { ...firestoreData, firstName, lastName, email: user.email };
        const fullProfileData = sanitizeProfileData(combinedData); // Usar la utilidad centralizada
        
        localStorage.setItem('bocado-profile-data', JSON.stringify(fullProfileData));
        localStorage.removeItem('bocado-form');
        onRegistrationComplete();
      } else {
        throw new Error("No se encontró el perfil del usuario después del registro.");
      }
  
    } catch (error: any) {
      console.error("Error en el proceso de registro:", error);
      if (error.message.includes("email-already-in-use") || error.message.includes("already exists")) {
        setSubmissionError("Este correo electrónico ya está registrado.");
        setCurrentStep(1);
      } else if (error.name === 'TypeError') { // Network error, likely CORS
        setSubmissionError("Error de conexión. Asegúrate de que tu función de Cloud Run tiene CORS habilitado.");
      }
      else {
        setSubmissionError("No se pudo crear la cuenta. Por favor, revisa tus datos.");
      }
    } finally {
      setIsLoading(false);
    }
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 data={formData} updateData={updateFormData} errors={errors} />;
      case 2:
        return <Step3 data={formData} updateData={updateFormData} errors={errors} />;
      default:
        return null;
    }
  };

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
