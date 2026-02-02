
import React, { useState } from 'react';
import { FormData } from '../../types';
import { FormStepProps } from './FormStepProps';
import { COUNTRIES, GENDERS, EMAIL_DOMAINS, COOKING_AFFINITY } from '../../constants';
import { CITIES_BY_COUNTRY } from '../../data/cities';
import { MaleIcon } from '../icons/MaleIcon';
import { FemaleIcon } from '../icons/FemaleIcon';
import { OtherGenderIcon } from '../icons/OtherGenderIcon';
import { LockIcon } from '../icons/LockIcon';

const GenderButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}> = ({ label, icon, isSelected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 ${
      isSelected
        ? 'bg-bocado-green text-white border-bocado-green shadow-lg'
        : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-bocado-green'
    }`}
  >
    {icon}
    <span className="font-semibold text-sm">{label}</span>
  </button>
);


const Step1: React.FC<FormStepProps> = ({ data, updateData, errors, hidePasswordFields, disableEmail }) => {
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateData(name as keyof FormData, value);
    if (name === 'country') {
      // Reset city when country changes
      updateData('city', '');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Remove any character that is not a letter, space, hyphen, apostrophe, or accented character.
    const validValue = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]/g, '');
    updateData(name as keyof FormData, validValue);
  };
  
  const handleAgeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevents decimal points, scientific notation, and signs
    if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
        e.preventDefault();
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateData('email', value);

    const atIndex = value.indexOf('@');
    if (atIndex > -1) {
      const textBeforeAt = value.substring(0, atIndex);
      const textAfterAt = value.substring(atIndex + 1);

      const filtered = EMAIL_DOMAINS
        .filter(domain => domain.startsWith(textAfterAt))
        .map(domain => `${textBeforeAt}@${domain}`);

      setEmailSuggestions(filtered);
      setShowEmailSuggestions(filtered.length > 0);
    } else {
      setShowEmailSuggestions(false);
    }
  };

  const handleEmailSuggestionClick = (suggestion: string) => {
    updateData('email', suggestion);
    setShowEmailSuggestions(false);
  };

  const genderIcons = {
    'Mujer': <FemaleIcon className="w-5 h-5" />,
    'Hombre': <MaleIcon className="w-5 h-5" />,
    'Otro': <OtherGenderIcon className="w-5 h-5" />,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-bocado-dark-green text-center">Cuéntanos sobre ti</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre(s)</label>
          <input type="text" name="firstName" value={data.firstName} onChange={handleNameChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`} />
          {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Apellido(s)</label>
          <input type="text" name="lastName" value={data.lastName} onChange={handleNameChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`} />
          {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Género</label>
        <div className="flex gap-2">
            {GENDERS.map(gender => (
                <GenderButton 
                    key={gender}
                    label={gender}
                    icon={genderIcons[gender as keyof typeof genderIcons]}
                    isSelected={data.gender === gender}
                    onClick={() => updateData('gender', gender)}
                />
            ))}
        </div>
        {errors.gender && <p className="text-red-500 text-xs mt-2 text-center">{errors.gender}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700">Edad</label>
            <input type="number" name="age" value={data.age} onChange={handleChange} onKeyDown={handleAgeKeyDown} min="10" max="100" placeholder="Ej: 25" className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.age ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`} />
            {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">País</label>
            <select name="country" value={data.country} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.country ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`}>
                 <option value="">Selecciona...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
        </div>
        
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Ciudad</label>
            {data.country && data.country !== 'Otro' ? (
              <select
                name="city"
                value={data.city}
                onChange={handleChange}
                disabled={!data.country}
                className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.city ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green disabled:bg-gray-50`}
              >
                <option value="">Selecciona tu ciudad...</option>
                {(CITIES_BY_COUNTRY[data.country] || []).map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                name="city" 
                value={data.city} 
                onChange={handleChange} 
                disabled={!data.country}
                placeholder={data.country === 'Otro' ? 'Escribe tu ciudad...' : 'Selecciona un país primero'}
                className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.city ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green disabled:bg-gray-50`} 
              />
            )}
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
        </div>
      </div>
      
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <div className="relative">
            <input 
            type="email" 
            name="email" 
            value={data.email} 
            onChange={handleEmailChange}
            onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
            autoComplete="off"
            disabled={disableEmail}
            className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green ${disableEmail ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} 
            />
            {disableEmail && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <LockIcon className="w-4 h-4" />
                </div>
            )}
        </div>
        {showEmailSuggestions && emailSuggestions.length > 0 && !disableEmail && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <ul className="max-h-60 overflow-auto">
              {emailSuggestions.map((suggestion) => (
                <li 
                  key={suggestion}
                  onClick={() => handleEmailSuggestionClick(suggestion)}
                  className="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        {disableEmail && <p className="text-xs text-gray-400 mt-1">El correo no se puede cambiar aquí. Ve a seguridad de la cuenta.</p>}
      </div>

      {!hidePasswordFields && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input type="password" name="password" value={data.password || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`} />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 8 caracteres, una mayúscula, un número y un caracter especial (!@#$%^&*).
            </p>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
            <input type="password" name="confirmPassword" value={data.confirmPassword || ''} onChange={handleChange} className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`} />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">¿Te gusta cocinar?</label>
        <div className="flex flex-wrap gap-2">
            {COOKING_AFFINITY.map(affinity => (
                <button key={affinity} type="button" onClick={() => updateData('cookingAffinity', affinity)} className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors duration-200 ${data.cookingAffinity === affinity ? 'bg-bocado-green text-white border-bocado-green' : 'bg-white text-gray-700 border-gray-300 hover:border-bocado-green'}`}>
                    {affinity}
                </button>
            ))}
        </div>
        {errors.cookingAffinity && <p className="text-red-500 text-xs mt-1">{errors.cookingAffinity}</p>}
      </div>

    </div>
  );
};

export default Step1;
