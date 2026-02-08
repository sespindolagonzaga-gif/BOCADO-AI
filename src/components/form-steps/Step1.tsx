import React, { useState } from 'react';
import { FormData } from '../../types';
import { FormStepProps } from './FormStepProps';
import { EMAIL_DOMAINS } from '../../constants';
import { MaleIcon } from '../icons/MaleIcon';
import { FemaleIcon } from '../icons/FemaleIcon';
import { OtherGenderIcon } from '../icons/OtherGenderIcon';
import { LockIcon } from '../icons/LockIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { ScaleIcon } from '../icons/ScaleIcon';
import { RulerIcon } from '../icons/RulerIcon';
import { trackEvent } from '../../firebaseConfig';

const COUNTRIES_LIST = [
  { name: 'México', code: 'MX' },
  { name: 'España', code: 'ES' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Estados Unidos', code: 'US' },
  { name: 'Canadá', code: 'CA' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Brasil', code: 'BR' },
  { name: 'Chile', code: 'CL' },
  { name: 'Perú', code: 'PE' },
  { name: 'Ecuador', code: 'EC' },
  { name: 'Venezuela', code: 'VE' },
  { name: 'Uruguay', code: 'UY' },
  { name: 'Paraguay', code: 'PY' },
  { name: 'Bolivia', code: 'BO' },
  { name: 'Panamá', code: 'PA' },
  { name: 'Costa Rica', code: 'CR' },
  { name: 'Guatemala', code: 'GT' },
  { name: 'Honduras', code: 'HN' },
  { name: 'El Salvador', code: 'SV' },
  { name: 'República Dominicana', code: 'DO' },
  { name: 'Cuba', code: 'CU' },
  { name: 'Francia', code: 'FR' },
  { name: 'Alemania', code: 'DE' },
  { name: 'Italia', code: 'IT' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Reino Unido', code: 'GB' },
  { name: 'Australia', code: 'AU' },
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
    className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 active:scale-95 ${
      isSelected
        ? 'bg-bocado-green text-white border-bocado-green shadow-sm'
        : 'bg-white border-bocado-border text-bocado-dark-gray hover:border-bocado-green/50'
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
    trackEvent('registration_country_select', { country_code: code });
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
    trackEvent('registration_city_suggestion_click', { city: cityName });
    setLocalCityQuery(cityName);
    updateData('city', cityName);
    if (onClearCityOptions) onClearCityOptions();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const validValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    updateData(name as keyof FormData, validValue);
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (/^\d{0,3}$/.test(value))) {
      const num = parseInt(value);
      if (value === '' || (num >= 1 && num <= 120)) {
        updateData('age', value);
      }
    }
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d{0,3}(\.\d{0,1})?$/.test(value)) {
      updateData('weight', value);
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d{0,3}$/.test(value)) {
      const num = parseInt(value);
      if (value === '' || (num >= 0 && num <= 300)) {
        updateData('height', value);
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
    <div className="space-y-4 animate-fade-in">
      {/* Nombre y Apellido */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Nombre *</label>
          <input 
            type="text" 
            name="firstName" 
            value={data.firstName} 
            onChange={handleNameChange} 
            onFocus={() => trackEvent('registration_input_focus', { field: 'firstName' })}
            placeholder="Juan" 
            className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
              errors.firstName ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
            }`} 
          />
          {errors.firstName && <p className="text-red-500 text-[10px] mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Apellido *</label>
          <input 
            type="text" 
            name="lastName" 
            value={data.lastName} 
            onChange={handleNameChange} 
            onFocus={() => trackEvent('registration_input_focus', { field: 'lastName' })}
            placeholder="Pérez" 
            className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
              errors.lastName ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
            }`} 
          />
          {errors.lastName && <p className="text-red-500 text-[10px] mt-1">{errors.lastName}</p>}
        </div>
      </div>

      {/* Género y Edad - Responsive: columna en móvil, grid en desktop */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-bocado-dark-gray mb-2 uppercase tracking-wider text-center sm:text-left">Género *</label>
          <div className="flex gap-2">
            {['Mujer', 'Hombre', 'Otro'].map(gender => (
              <GenderButton 
                key={gender}
                label={gender}
                icon={gender === 'Mujer' ? <FemaleIcon className="w-4 h-4"/> : gender === 'Hombre' ? <MaleIcon className="w-4 h-4"/> : <OtherGenderIcon className="w-4 h-4"/>}
                isSelected={data.gender === gender}
                onClick={() => {
                  trackEvent('registration_gender_select', { gender });
                  updateData('gender', gender);
                }}
              />
            ))}
          </div>
          {errors.gender && <p className="text-red-500 text-[10px] mt-1 text-center sm:text-left">{errors.gender}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Edad *</label>
          <input 
            type="text"
            inputMode="numeric"
            value={data.age} 
            onChange={handleAgeChange} 
            onFocus={() => trackEvent('registration_input_focus', { field: 'age' })}
            placeholder="25" 
            className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm text-center transition-all ${
              errors.age ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
            }`} 
          />
          {errors.age && <p className="text-red-500 text-[10px] mt-1">{errors.age}</p>}
        </div>
      </div>

      {/* Datos corporales */}
      <div className="bg-bocado-background p-3 rounded-xl border border-bocado-border">
        <p className="text-[10px] font-bold text-bocado-gray mb-2 uppercase tracking-wider">Datos corporales (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-bocado-dark-gray mb-1">Peso (kg)</label>
            <div className="relative">
              <ScaleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
              <input 
                type="text"
                inputMode="decimal"
                value={data.weight || ''} 
                onChange={handleWeightChange} 
                placeholder="70" 
                className="w-full pl-8 pr-6 py-2 rounded-lg border border-bocado-border bg-white text-sm focus:outline-none focus:border-bocado-green"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-bocado-gray font-medium">kg</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-bocado-dark-gray mb-1">Estatura (cm)</label>
            <div className="relative">
              <RulerIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
              <input 
                type="text"
                value={data.height || ''} 
                onChange={handleHeightChange} 
                placeholder="175" 
                className="w-full pl-8 pr-6 py-2 rounded-lg border border-bocado-border bg-white text-sm focus:outline-none focus:border-bocado-green"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-bocado-gray font-medium">cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* País y Ciudad */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">País *</label>
          <div className="relative">
            <LocationIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
            <select 
              value={data.country} 
              onChange={handleCountrySelect} 
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border-2 appearance-none bg-white text-sm transition-all ${
                errors.country ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              }`}
            >
              <option value="">Selecciona...</option>
              {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          {errors.country && <p className="text-red-500 text-[10px] mt-1">{errors.country}</p>}
        </div>

        <div className="relative">
          <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Ciudad *</label>
          <div className="relative">
            <input 
              type="text" 
              value={localCityQuery}
              onChange={handleCitySearchChange}
              disabled={!data.country}
              onFocus={() => trackEvent('registration_city_input_focus')}
              placeholder={data.country ? "Tu ciudad..." : "Elige país primero"}
              className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                errors.city ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              } ${!data.country ? 'bg-bocado-background' : 'bg-white'}`} 
            />
            {isSearchingCity && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {cityOptions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-bocado-border rounded-xl shadow-bocado max-h-40 overflow-y-auto">
              {cityOptions.map((city: any) => (
                <button
                  key={city.geonameId}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-bocado-background border-b border-bocado-border/50 last:border-0 flex justify-between items-center active:bg-bocado-green/10"
                >
                  <span className="font-medium text-bocado-text">{city.name}</span>
                  <span className="text-bocado-gray text-[10px]">{city.adminName1}</span>
                </button>
              ))}
            </div>
          )}
          {errors.city && <p className="text-red-500 text-[10px] mt-1">{errors.city}</p>}
        </div>
      </div>
      
      {/* Email */}
      <div className="relative">
        <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Email *</label>
        <input 
          type="email" 
          value={data.email} 
          onChange={handleEmailChange}
          onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)}
          disabled={disableEmail}
          onFocus={() => trackEvent('registration_input_focus', { field: 'email' })}
          className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
            errors.email ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
          } ${disableEmail ? 'bg-bocado-background' : 'bg-white'}`} 
        />
        {showEmailSuggestions && emailSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-bocado-border rounded-xl shadow-bocado overflow-hidden">
            {emailSuggestions.map((s) => (
              <div 
                key={s} 
                onClick={() => { 
                  trackEvent('registration_email_suggestion_click');
                  updateData('email', s); 
                  setShowEmailSuggestions(false); 
                }} 
                className="px-3 py-2 text-sm hover:bg-bocado-background cursor-pointer border-b border-bocado-border/50 last:border-0 text-bocado-text"
              >
                {s}
              </div>
            ))}
          </div>
        )}
        {errors.email && <p className="text-red-500 text-[10px] mt-1">{errors.email}</p>}
      </div>

      {/* Password */}
      {!hidePasswordFields && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Contraseña *</label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
              <input 
                type="password" 
                name="password" 
                value={data.password || ''} 
                onChange={(e) => updateData('password', e.target.value)} 
                onFocus={() => trackEvent('registration_input_focus', { field: 'password' })}
                placeholder="8+ caracteres"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
                }`} 
              />
            </div>
            {errors.password && <p className="text-red-500 text-[10px] mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-bocado-dark-gray mb-1 uppercase tracking-wider">Confirmar *</label>
            <input 
              type="password" 
              name="confirmPassword" 
              value={data.confirmPassword || ''} 
              onChange={(e) => updateData('confirmPassword', e.target.value)} 
              onFocus={() => trackEvent('registration_input_focus', { field: 'confirmPassword' })}
              placeholder="Repite"
              className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              }`} 
            />
            {errors.confirmPassword && <p className="text-red-500 text-[10px] mt-1">{errors.confirmPassword}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1;