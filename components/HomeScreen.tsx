
import React, { useState, useEffect } from 'react';
import BocadoLogo from './BocadoLogo';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onGoToApp: () => void;
  onGoToLogin: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartRegistration, onGoToApp, onGoToLogin }) => {
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    const checkProfile = () => {
      const profileData = localStorage.getItem('bocado-profile-data');
      setProfileExists(!!profileData);
    };
    checkProfile();
    
    window.addEventListener('storage', checkProfile);
    return () => {
      window.removeEventListener('storage', checkProfile);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    } finally {
      localStorage.removeItem('bocado-profile-data');
      setProfileExists(false);
    }
  };

  return (
    <div className="text-center flex flex-col items-center justify-center min-h-screen space-y-8 animate-fade-in p-4">
      <BocadoLogo className="w-full max-w-lg -my-20 mx-auto" />
      <div>
        <p className="text-xl md:text-2xl text-bocado-dark-gray max-w-md">
          ¿Qué comer hoy? Ya no es <span className="underline">problema</span>
        </p>
        <p className="text-md text-bocado-gray mt-2">
          Se parte de Bocado, donde tú decides y la IA te acompaña.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        {profileExists ? (
          <>
            <button
              onClick={onGoToApp}
              className="bg-bocado-green text-white font-bold py-4 px-12 rounded-full text-lg shadow-lg hover:bg-bocado-green-light transition-colors duration-300 transform hover:scale-105"
            >
              Entrar
            </button>
            <button
              onClick={handleLogout}
              className="bg-white text-bocado-green border-2 border-bocado-green font-bold py-4 px-12 rounded-full text-lg shadow-lg hover:bg-gray-100 transition-colors duration-300 transform hover:scale-105"
            >
              Cerrar Sesión
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onStartRegistration}
              className="bg-bocado-green text-white font-bold py-4 px-12 rounded-full text-lg shadow-lg hover:bg-bocado-green-light transition-colors duration-300 transform hover:scale-105"
            >
              Registrarse
            </button>
            <button
              onClick={onGoToLogin}
              className="bg-white text-bocado-green border-2 border-bocado-green font-bold py-4 px-12 rounded-full text-lg shadow-lg hover:bg-gray-100 transition-colors duration-300 transform hover:scale-105"
            >
              Iniciar Sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;