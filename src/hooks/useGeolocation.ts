import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { trackEvent } from '../firebaseConfig';
import { reverseGeocode, detectLocationByIP } from '../services/mapsService';

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface DetectedLocation {
  country: string;
  countryCode: string;
  city: string;
  formattedAddress: string;
}

export interface GeolocationState {
  position: GeolocationPosition | null;
  detectedLocation: DetectedLocation | null;
  loading: boolean;
  error: string | null;
  permission: 'prompt' | 'granted' | 'denied' | 'unknown';
}

/**
 * Hook para obtener la geolocalización del usuario
 * Solo funciona en HTTPS o localhost
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    detectedLocation: null,
    loading: false,
    error: null,
    permission: 'unknown',
  });

  // Verificar el estado del permiso
  const checkPermission = useCallback(async () => {
    if (!('permissions' in navigator)) {
      return 'unknown' as const;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as 'prompt' | 'granted' | 'denied';
    } catch (error) {
      logger.warn('Error checking geolocation permission:', error);
      return 'unknown' as const;
    }
  }, []);

  // Solicitar ubicación
  const requestLocation = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setState(prev => ({
        ...prev,
        error: 'Tu navegador no soporta geolocalización',
        permission: 'denied',
      }));
      trackEvent('geolocation_error', { reason: 'not_supported' });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    trackEvent('geolocation_request');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        
        // Hacer reverse geocoding para detectar el país/cuidad actual
        let detectedLocation: DetectedLocation | null = null;
        try {
          const geoResult = await reverseGeocode(newPosition.lat, newPosition.lng);
          if (geoResult) {
            detectedLocation = {
              country: geoResult.country,
              countryCode: geoResult.countryCode,
              city: geoResult.city,
              formattedAddress: geoResult.formattedAddress,
            };
            logger.info(`📍 Ubicación detectada: ${geoResult.city}, ${geoResult.country} (${geoResult.countryCode})`);
          }
        } catch (geoError) {
          logger.warn('Error en reverse geocoding:', geoError);
          // No bloqueamos si el reverse geocoding falla
        }
        
        setState({
          position: newPosition,
          detectedLocation,
          loading: false,
          error: null,
          permission: 'granted',
        });
        
        trackEvent('geolocation_success', { 
          accuracy: position.coords.accuracy,
          lat: Math.round(position.coords.latitude * 100) / 100,
          lng: Math.round(position.coords.longitude * 100) / 100,
          country: detectedLocation?.countryCode,
        });
      },
      (error) => {
        let errorMessage = 'No se pudo obtener tu ubicación';
        let permission: 'denied' | 'prompt' | 'unknown' = 'unknown';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado';
            permission = 'denied';
            trackEvent('geolocation_denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible';
            permission = 'prompt';
            trackEvent('geolocation_error', { reason: 'unavailable' });
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado';
            permission = 'prompt';
            trackEvent('geolocation_error', { reason: 'timeout' });
            break;
        }

        setState({
          position: null,
          detectedLocation: null,
          loading: false,
          error: errorMessage,
          permission,
        });
      },
      {
        enableHighAccuracy: false, // true consume más batería
        timeout: 10000,
        maximumAge: 5 * 60 * 1000, // Cache de 5 minutos
      }
    );
  }, []);

  // Verificar permiso al montar
  useEffect(() => {
    checkPermission().then(permission => {
      setState(prev => ({ ...prev, permission }));
    });
  }, [checkPermission]);

  // Intentar detectar ubicación por IP al montar (fallback silencioso)
  useEffect(() => {
    const detectIPLocation = async () => {
      // Solo si no tenemos ya una ubicación detectada
      if (state.detectedLocation) return;
      
      try {
        const ipLocation = await detectLocationByIP();
        if (ipLocation) {
          logger.info(`📍 Ubicación detectada por IP: ${ipLocation.city}, ${ipLocation.country} (${ipLocation.countryCode})`);
          setState(prev => ({
            ...prev,
            detectedLocation: {
              country: ipLocation.country,
              countryCode: ipLocation.countryCode,
              city: ipLocation.city,
              formattedAddress: `${ipLocation.city}, ${ipLocation.country}`,
            },
          }));
          trackEvent('geolocation_ip_detected', {
            country: ipLocation.countryCode,
            city: ipLocation.city,
          });
        }
      } catch (error) {
        // Silenciar errores de IP detection, es solo un fallback
        logger.debug('IP detection failed (expected in some cases):', error);
      }
    };

    detectIPLocation();
  }, []); // Solo al montar

  // Limpiar posición
  const clearLocation = useCallback(() => {
    setState({
      position: null,
      detectedLocation: null,
      loading: false,
      error: null,
      permission: 'unknown',
    });
    trackEvent('geolocation_cleared');
  }, []);

  /**
   * Obtiene el código de país para usar en la moneda/budget.
   * Prioriza: 1) Ubicación detectada por geolocalización, 2) Fallback del parámetro
   */
  const getCountryCodeForCurrency = useCallback((fallbackCountryCode?: string): string => {
    if (state.detectedLocation?.countryCode) {
      return state.detectedLocation.countryCode;
    }
    return fallbackCountryCode || 'MX';
  }, [state.detectedLocation]);

  return {
    ...state,
    requestLocation,
    clearLocation,
    checkPermission,
    getCountryCodeForCurrency,
  };
}

export default useGeolocation;
