import React, { useState } from 'react';
import { FormData } from '../../types';
import { FormStepProps } from './FormStepProps';
import { GENDERS, EMAIL_DOMAINS, COOKING_AFFINITY } from '../../constants';
import { MaleIcon } from '../icons/MaleIcon';
import { FemaleIcon } from '../icons/FemaleIcon';
import { OtherGenderIcon } from '../icons/OtherGenderIcon';
import { LockIcon } from '../icons/LockIcon';
import { LocationIcon } from '../icons/LocationIcon';

// Lista amigable de países
const COUNTRIES_LIST = [
  { name: 'México', code: 'MX' },
  { name: 'España', code: 'ES' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Chile', code: 'CL' },
  { name: 'Perú', code: 'PE' },
  { name: 'Estados Unidos', code: 'US' },
  { name: 'Ecuador', code: 'EC' },
  { name: 'Venezuela', code: 'VE' },
];

interface ExtendedStep1Props extends FormStepProps {
  cityOptions?: any[];
  isSearchingCity?: boolean;
  onSearchCity?: (query: string) => void;
  onClearCityOptions?: () => void;
  onCountryChange?: (code: string, name: string) => void; 
}

const GenderButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}> = ({ label, icon, isSelected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all duration-200 ${
      isSelected
        ? 'bg-bocado-green text-white border-bocado-green shadow-md'
        : 'bg-white border-gray-100 hover:border-bocado-green/50 text-gray-600'
    }`}
  >
    {icon}
    <span className="font-bold text-xs">{label}</span>
  </button>
);

const Step1: React.FC<ExtendedStep1Props> = ({ 
  data, updateData, errors, hidePasswordFields, disableEmail,
  cityOptions = [], isSearchingCity = false, onSearchCity, onClearCityOptions,
  onCountryChange
}) => {
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [localCityQuery, setLocalCityQuery] = useState(data.city || '');

  const handleCountrySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    
    setLocalCityQuery('');
    
    if (onCountryChange) {
      onCountryChange(code, name);
    } else {
      updateData('country', code);
    }
  };

  const handleCitySearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalCityQuery(value);
    updateData('city', value);
    if (onSearchCity) onSearchCity(value);
  };

  const handleSelectCity = (city: any) => {
    const cityName = city.name;
    setLocalCityQuery(cityName);
    updateData('city', cityName);
    if (onClearCityOptions) onClearCityOptions();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const validValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    updateData(name as keyof FormData, validValue);
  };

  // Handler para la edad (solo números)
  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Solo permite números y máximo 3 dígitos (edades razonables)
    if (value === '' || (/^\d+$/.test(value) && value.length <= 3)) {
      const ageNum = parseInt(value);
      if (value === '' || (ageNum >= 1 && ageNum <= 120)) {
        updateData('age', value);
      }
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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Nombre y Apellido */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Nombre(s)</label>
          <input 
            type="text" 
            name="firstName" 
            value={data.firstName} 
            onChange={handleNameChange} 
            placeholder="Ej. Juan" 
            className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'}`} 
          />
          {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Apellido(s)</label>
          <input 
            type="text" 
            name="lastName" 
            value={data.lastName} 
            onChange={handleNameChange} 
            placeholder="Ej. Pérez" 
            className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'}`} 
          />
          {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
        </div>
      </div>

      {/* Género y Edad */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-bocado-dark-green mb-2 ml-1 uppercase text-center">Género</label>
          <div className="flex gap-3">
            {['Mujer', 'Hombre', 'Otro'].map(gender => (
              <GenderButton 
                key={gender}
                label={gender}
                icon={gender === 'Mujer' ? <FemaleIcon className="w-5 h-5"/> : gender === 'Hombre' ? <MaleIcon className="w-5 h-5"/> : <OtherGenderIcon className="w-5 h-5"/>}
                isSelected={data.gender === gender}
                onClick={() => updateData('gender', gender)}
              />
            ))}
          </div>
          {errors.gender && <p className="text-red-500 text-xs mt-1 text-center">{errors.gender}</p>}
        </div>

        {/* EDAD - NUEVO CAMPO */}
        <div>
          <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Edad</label>
          <input 
            type="number" 
            inputMode="numeric"
            pattern="[0-9]*"
            value={data.age} 
            onChange={handleAgeChange} 
            placeholder="Ej. 25" 
            min="1"
            max="120"
            className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-center ${errors.age ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'}`} 
          />
          {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
        </div>
      </div>

      {/* País y Ciudad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">País</label>
          <div className="relative">
            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select 
              value={data.country} 
              onChange={handleCountrySelect} 
              className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 appearance-none bg-white transition-all ${errors.country ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'}`}
            >
              <option value="">Selecciona...</option>
              {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
        </div>

        <div className="relative">
          <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Ciudad</label>
          <div className="relative">
            <input 
              type="text" 
              value={localCityQuery}
              onChange={handleCitySearchChange}
              disabled={!data.country}
              placeholder={data.country ? "Escribe tu ciudad..." : "Elige un país"}
              className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${errors.city ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none disabled:bg-gray-50'}`} 
            />
            {isSearchingCity && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {cityOptions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
              {cityOptions.map((city: any) => (
                <button
                  key={city.geonameId}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-bocado-green/5 border-b border-gray-50 last:border-0 flex justify-between items-center"
                >
                  <span className="font-bold text-gray-700">{city.name}</span>
                  <span className="text-gray-400 text-[10px] uppercase">{city.adminName1}</span>
                </button>
              ))}
            </div>
          )}
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
        </div>
      </div>
      
      {/* Email */}
      <div className="relative">
        <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Email</label>
        <input 
          type="email" 
          value={data.email} 
          onChange={handleEmailChange}
          onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)}
          disabled={disableEmail}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'} ${disableEmail ? 'bg-gray-100' : ''}`} 
        />
        {showEmailSuggestions && emailSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg">
            {emailSuggestions.map((s) => (
              <div 
                key={s} 
                onClick={() => { updateData('email', s); setShowEmailSuggestions(false); }} 
                className="px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
              >
                {s}
              </div>
            ))}
          </div>
        )}
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      {/* Password */}
      {!hidePasswordFields && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Contraseña</label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password" 
                name="password" 
                value={data.password || ''} 
                onChange={(e) => updateData('password', e.target.value)} 
                className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'}`} 
              />
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-bocado-dark-green mb-1 ml-1 uppercase">Confirmar</label>
            <input 
              type="password" 
              name="confirmPassword" 
              value={data.confirmPassword || ''} 
              onChange={(e) => updateData('confirmPassword', e.target.value)} 
              className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-100 focus:border-bocado-green focus:outline-none'}`} 
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1;