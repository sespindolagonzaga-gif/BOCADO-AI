import React, { useState } from 'react';
import { FormData } from '../../types';
import { FormStepProps } from './FormStepProps';
import { useTranslation } from '../../contexts/I18nContext';
import { EMAIL_DOMAINS } from '../../constants';
import { MaleIcon } from '../icons/MaleIcon';
import { FemaleIcon } from '../icons/FemaleIcon';
import { OtherGenderIcon } from '../icons/OtherGenderIcon';
import { Lock, MapPin, Scale, Ruler } from '../icons';
import { trackEvent } from '../../firebaseConfig';
import type { PlacePrediction } from '../../services/mapsService';

const COUNTRIES_LIST = [
  // América del Norte
  { nameKey: 'mexico', code: 'MX' },
  { nameKey: 'usa', code: 'US' },
  { nameKey: 'canada', code: 'CA' },
  
  // América Central y Caribe
  { nameKey: 'guatemala', code: 'GT' },
  { nameKey: 'elsalvador', code: 'SV' },
  { nameKey: 'honduras', code: 'HN' },
  { nameKey: 'nicaragua', code: 'NI' },
  { nameKey: 'costarica', code: 'CR' },
  { nameKey: 'panama', code: 'PA' },
  { nameKey: 'cuba', code: 'CU' },
  { nameKey: 'dominicanrepublic', code: 'DO' },
  { nameKey: 'puertorico', code: 'PR' },
  { nameKey: 'jamaica', code: 'JM' },
  { nameKey: 'haiti', code: 'HT' },
  { nameKey: 'trinidadtobago', code: 'TT' },
  { nameKey: 'belize', code: 'BZ' },
  
  // América del Sur
  { nameKey: 'argentina', code: 'AR' },
  { nameKey: 'bolivia', code: 'BO' },
  { nameKey: 'brazil', code: 'BR' },
  { nameKey: 'chile', code: 'CL' },
  { nameKey: 'colombia', code: 'CO' },
  { nameKey: 'ecuador', code: 'EC' },
  { nameKey: 'guyana', code: 'GY' },
  { nameKey: 'paraguay', code: 'PY' },
  { nameKey: 'peru', code: 'PE' },
  { nameKey: 'suriname', code: 'SR' },
  { nameKey: 'uruguay', code: 'UY' },
  { nameKey: 'venezuela', code: 'VE' },
  
  // Europa
  { nameKey: 'spain', code: 'ES' },
  { nameKey: 'germany', code: 'DE' },
  { nameKey: 'france', code: 'FR' },
  { nameKey: 'italy', code: 'IT' },
  { nameKey: 'portugal', code: 'PT' },
  { nameKey: 'uk', code: 'GB' },
  { nameKey: 'ireland', code: 'IE' },
  { nameKey: 'netherlands', code: 'NL' },
  { nameKey: 'belgium', code: 'BE' },
  { nameKey: 'switzerland', code: 'CH' },
  { nameKey: 'austria', code: 'AT' },
  { nameKey: 'sweden', code: 'SE' },
  { nameKey: 'norway', code: 'NO' },
  { nameKey: 'denmark', code: 'DK' },
  { nameKey: 'finland', code: 'FI' },
  { nameKey: 'poland', code: 'PL' },
  { nameKey: 'czechrepublic', code: 'CZ' },
  { nameKey: 'slovakia', code: 'SK' },
  { nameKey: 'hungary', code: 'HU' },
  { nameKey: 'romania', code: 'RO' },
  { nameKey: 'bulgaria', code: 'BG' },
  { nameKey: 'croatia', code: 'HR' },
  { nameKey: 'slovenia', code: 'SI' },
  { nameKey: 'greece', code: 'GR' },
  { nameKey: 'ukraine', code: 'UA' },
  { nameKey: 'russia', code: 'RU' },
  
  // Asia
  { nameKey: 'china', code: 'CN' },
  { nameKey: 'japan', code: 'JP' },
  { nameKey: 'southkorea', code: 'KR' },
  { nameKey: 'india', code: 'IN' },
  { nameKey: 'thailand', code: 'TH' },
  { nameKey: 'vietnam', code: 'VN' },
  { nameKey: 'indonesia', code: 'ID' },
  { nameKey: 'malaysia', code: 'MY' },
  { nameKey: 'philippines', code: 'PH' },
  { nameKey: 'singapore', code: 'SG' },
  { nameKey: 'israel', code: 'IL' },
  { nameKey: 'turkey', code: 'TR' },
  { nameKey: 'saudiarabia', code: 'SA' },
  { nameKey: 'uae', code: 'AE' },
  { nameKey: 'qatar', code: 'QA' },
  { nameKey: 'kuwait', code: 'KW' },
  
  // Oceanía
  { nameKey: 'australia', code: 'AU' },
  { nameKey: 'newzealand', code: 'NZ' },
  
  // África
  { nameKey: 'southafrica', code: 'ZA' },
  { nameKey: 'egypt', code: 'EG' },
  { nameKey: 'nigeria', code: 'NG' },
  { nameKey: 'kenya', code: 'KE' },
  { nameKey: 'morocco', code: 'MA' },
];

interface ExtendedStep1Props extends FormStepProps {
  cityOptions?: PlacePrediction[];
  isSearchingCity?: boolean;
  onSearchCity?: (query: string) => void;
  onClearCityOptions?: () => void;
  onCountryChange?: (code: string, name: string) => void;
  selectedPlaceId?: string;
}

const GenderButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  testId?: string;
}> = ({ label, icon, isSelected, onClick, testId }) => (
  <button
    type="button"
    data-testid={testId}
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
  const { t } = useTranslation();
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

  const handleSelectCity = (city: PlacePrediction) => {
    trackEvent('registration_city_suggestion_click', { city: city.mainText });
    setLocalCityQuery(city.mainText);
    // Guardar el placeId para obtener coordenadas después
    updateData('city', city.mainText);
    updateData('cityPlaceId', city.placeId);
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
          <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.firstName')}</label>
          <input 
            type="text" 
            name="firstName"
            data-testid="firstName-input"
            value={data.firstName} 
            onChange={handleNameChange} 
            onFocus={() => trackEvent('registration_input_focus', { field: 'firstName' })}
            placeholder={t('step1.firstNamePlaceholder')} 
            className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
              errors.firstName ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
            }`} 
          />
          {errors.firstName && <p className="text-red-500 text-2xs mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.lastName')}</label>
          <input 
            type="text" 
            name="lastName"
            data-testid="lastName-input"
            value={data.lastName} 
            onChange={handleNameChange} 
            onFocus={() => trackEvent('registration_input_focus', { field: 'lastName' })}
            placeholder={t('step1.lastNamePlaceholder')} 
            className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
              errors.lastName ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
            }`} 
          />
          {errors.lastName && <p className="text-red-500 text-2xs mt-1">{errors.lastName}</p>}
        </div>
      </div>

      {/* Género y Edad - Desktop: lado a lado, Móvil: stacked */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Género - Izquierda en desktop */}
        <div className="flex-1">
          <label className="block text-2xs font-bold text-bocado-dark-gray mb-2 uppercase tracking-wider text-center sm:text-left">{t('step1.gender')}</label>
          <div className="flex gap-2 max-w-[320px] mx-auto sm:mx-0">
            {[
              { value: 'Mujer', label: t('step1.genderFemale'), testId: 'gender-female', icon: <FemaleIcon className="w-4 h-4"/> },
              { value: 'Hombre', label: t('step1.genderMale'), testId: 'gender-male', icon: <MaleIcon className="w-4 h-4"/> },
              { value: 'Otro', label: t('step1.genderOther'), testId: 'gender-other', icon: <OtherGenderIcon className="w-4 h-4"/> }
            ].map(({ value, label, testId, icon }) => (
              <GenderButton 
                key={value}
                label={label}
                testId={testId}
                icon={icon}
                isSelected={data.gender === value}
                onClick={() => {
                  trackEvent('registration_gender_select', { gender: value });
                  updateData('gender', value);
                }}
              />
            ))}
          </div>
          {errors.gender && <p className="text-red-500 text-2xs mt-1 text-center sm:text-left">{errors.gender}</p>}
        </div>

        {/* Edad - Derecha en desktop */}
        <div className="sm:w-28">
          <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider text-center sm:text-left">{t('step1.age')}</label>
          <input 
            type="text"
            inputMode="numeric"
            value={data.age} 
            onChange={handleAgeChange} 
            onFocus={() => trackEvent('registration_input_focus', { field: 'age' })}
            placeholder={t('step1.agePlaceholder')} 
            className={`w-full sm:w-24 px-3 py-2.5 rounded-xl border-2 text-sm text-center sm:text-left transition-all ${
              errors.age ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
            }`} 
          />
          {errors.age && <p className="text-red-500 text-2xs mt-1 text-center sm:text-left">{errors.age}</p>}
        </div>
      </div>

      {/* Datos corporales */}
      <div className="bg-bocado-background p-3 rounded-xl border border-bocado-border">
        <p className="text-2xs font-bold text-bocado-gray mb-2 uppercase tracking-wider">{t('step1.bodyData')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-medium text-bocado-dark-gray mb-1">{t('step1.weight')}</label>
            <div className="relative">
              <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
              <input 
                type="text"
                inputMode="decimal"
                value={data.weight || ''} 
                onChange={handleWeightChange} 
                placeholder={t('step1.weightPlaceholder')} 
                className="w-full pl-8 pr-6 py-2 rounded-lg border border-bocado-border bg-white text-sm focus:outline-none focus:border-bocado-green"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-bocado-gray font-medium">{t('step1.weightUnit')}</span>
            </div>
          </div>

          <div>
            <label className="block text-2xs font-medium text-bocado-dark-gray mb-1">{t('step1.height')}</label>
            <div className="relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
              <input 
                type="text"
                value={data.height || ''} 
                onChange={handleHeightChange} 
                placeholder={t('step1.heightPlaceholder')} 
                className="w-full pl-8 pr-6 py-2 rounded-lg border border-bocado-border bg-white text-sm focus:outline-none focus:border-bocado-green"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-bocado-gray font-medium">{t('step1.heightUnit')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* País y Ciudad */}
      <div className="space-y-3">
        <div>
          <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.country')}</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
            <select 
              value={data.country} 
              onChange={handleCountrySelect} 
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border-2 appearance-none bg-white text-sm transition-all ${
                errors.country ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              }`}
            >
              <option value="">{t('step1.selectCountry')}</option>
              {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{t(`countries.${c.nameKey}`)}</option>)}
            </select>
          </div>
          {errors.country && <p className="text-red-500 text-2xs mt-1">{errors.country}</p>}
        </div>

        <div className="relative">
          <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.city')}</label>
          <div className="relative">
            <input 
              type="text" 
              value={localCityQuery}
              onChange={handleCitySearchChange}
              disabled={!data.country}
              onFocus={() => trackEvent('registration_city_input_focus')}
              placeholder={data.country ? t('step1.cityPlaceholder') : t('step1.cityDisabled')}
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
            <div className="absolute z-50 w-full mt-1 bg-white border border-bocado-border rounded-xl shadow-bocado max-h-40 overflow-y-auto" role="listbox" aria-label={t('step1.citySuggestions')}>
              {cityOptions.map((city, idx) => (
                <button
                  key={city.placeId}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-bocado-background border-b border-bocado-border/50 last:border-0 flex flex-col active:bg-bocado-green/10"
                >
                  <span className="font-medium text-bocado-text">{city.mainText}</span>
                  <span className="text-bocado-gray text-2xs">{city.secondaryText}</span>
                </button>
              ))}
            </div>
          )}
          {errors.city && <p className="text-red-500 text-2xs mt-1">{errors.city}</p>}
        </div>
      </div>
      
      {/* Email */}
      <div className="relative">
        <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.email')}</label>
        <input 
          type="email"
          name="email"
          data-testid="email-input"
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
          <div className="absolute z-10 w-full mt-1 bg-white border border-bocado-border rounded-xl shadow-bocado overflow-hidden" role="listbox" aria-label={t('step1.emailSuggestions')}>
            {emailSuggestions.map((s) => (
              <div 
                key={s} 
                role="option"
                tabIndex={0}
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
        {errors.email && <p className="text-red-500 text-2xs mt-1">{errors.email}</p>}
      </div>

      {/* Password */}
      {!hidePasswordFields && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bocado-gray" />
              <input 
                type="password" 
                name="password"
                data-testid="password-input"
                value={data.password || ''} 
                onChange={(e) => updateData('password', e.target.value)} 
                onFocus={() => trackEvent('registration_input_focus', { field: 'password' })}
                placeholder={t('step1.passwordPlaceholder')}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                  errors.password ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
                }`} 
              />
            </div>
            {errors.password && <p className="text-red-500 text-2xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">{t('step1.confirmPassword')}</label>
            <input 
              type="password" 
              name="confirmPassword"
              data-testid="confirmPassword-input"
              value={data.confirmPassword || ''} 
              onChange={(e) => updateData('confirmPassword', e.target.value)} 
              onFocus={() => trackEvent('registration_input_focus', { field: 'confirmPassword' })}
              placeholder={t('step1.confirmPasswordPlaceholder')}
              className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              }`} 
            />
            {errors.confirmPassword && <p className="text-red-500 text-2xs mt-1">{errors.confirmPassword}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Step1;