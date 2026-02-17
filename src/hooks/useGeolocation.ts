import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
 * ✅ FIX #9: Better Safari iOS detection and permission handling
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    detectedLocation: null,
    loading: false,
    error: null,
    permission: 'unknown',
  });
  
  // 🔴 FIX #22: Usar ref para evitar recreación de getCountryCodeForCurrency
  const detectedLocationRef = useRef<DetectedLocation | null>(null);
  
  // Actualizar ref cuando cambia detectedLocation
  useEffect(() => {
    detectedLocationRef.current = state.detectedLocation;
  }, [state.detectedLocation]);

  // ✅ FIX #9: Detect Safari iOS for proper permission handling
  const isSafariIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const webkit = /WebKit/.test(ua);
    const chrome = /CriOS|Chrome/.test(ua);
    return iOS && webkit && !chrome;
  }, []);

  // Verificar el estado del permiso
  const checkPermission = useCallback(async () => {
    // ✅ FIX #9: Safari iOS doesn't support permissions API for geolocation
    if (isSafariIOS || !('permissions' in navigator)) {
      logger.info('[useGeolocation] Safari iOS or no permissions API, returning prompt');
      return 'prompt' as const;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as 'prompt' | 'granted' | 'denied';
    } catch (error) {
      logger.warn('Error checking geolocation permission:', error);
      return 'unknown' as const;
    }
  }, [isSafariIOS]);

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
    // 🟡 FIX #25: Wrap trackEvent en try-catch
    try {
      trackEvent('geolocation_request');
    } catch (error) {
      logger.warn('[useGeolocation] Analytics failed:', error);
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // 🟠 FIX #24: Validar que position.coords existe antes de acceder
        if (!position?.coords) {
          logger.error('[useGeolocation] Invalid position object, missing coords');
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Ubicación inválida recibida del navegador'
          }));
          return;
        }
        
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
        
        // 🟡 FIX #25: Wrap trackEvent en try-catch
        try {
          trackEvent('geolocation_success', { 
            accuracy: position.coords.accuracy,
            lat: Math.round(position.coords.latitude * 100) / 100,
            lng: Math.round(position.coords.longitude * 100) / 100,
            country: detectedLocation?.countryCode,
          });
        } catch (error) {
          logger.warn('[useGeolocation] Analytics failed:', error);
        }
      },
      (error) => {
        let errorMessage = 'No se pudo obtener tu ubicación';
        let permission: 'denied' | 'prompt' | 'unknown' = 'unknown';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado';
            permission = 'denied';
            // 🟡 FIX #25: Wrap trackEvent en try-catch
            try {
              trackEvent('geolocation_denied');
            } catch (err) {
              logger.warn('[useGeolocation] Analytics failed:', err);
            }
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible';
            permission = 'prompt';
            try {
              trackEvent('geolocation_error', { reason: 'unavailable' });
            } catch (err) {
              logger.warn('[useGeolocation] Analytics failed:', err);
            }
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado';
            permission = 'prompt';
            try {
              trackEvent('geolocation_error', { reason: 'timeout' });
            } catch (err) {
              logger.warn('[useGeolocation] Analytics failed:', err);
            }
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

  // 🔴 FIX #21: Remover checkPermission de dependencies para evitar loop infinito
  // Verificar permiso al montar
  useEffect(() => {
    checkPermission().then(permission => {
      setState(prev => ({ ...prev, permission }));
    });
  }, []); // ✅ Solo ejecutar en mount

  // Intentar detectar ubicación por IP al montar (fallback silencioso)
  useEffect(() => {
    const detectIPLocation = async () => {
      // Solo si no tenemos ya una ubicación detectada
      if (state.detectedLocation) return;
      
      try {
        const ipLocation = await detectLocationByIP();
        
        // ✅ FIX: Validar estructura completa antes de usar
        if (ipLocation && 
            ipLocation.city && 
            ipLocation.country && 
            ipLocation.countryCode) {
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
        } else {
          logger.warn('IP location data incomplete, skipping:', ipLocation);
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
    // 🟡 FIX #25: Wrap trackEvent en try-catch
    try {
      trackEvent('geolocation_cleared');
    } catch (error) {
      logger.warn('[useGeolocation] Analytics failed:', error);
    }
  }, []);

  /**
   * 🔴 FIX #22: Usar ref para evitar loop infinito
   * Obtiene el código de país para usar en la moneda/budget.
   * Prioriza: 1) Ubicación detectada por geolocalización, 2) Fallback del parámetro
   */
  const getCountryCodeForCurrency = useCallback((fallbackCountryCode?: string): string => {
    if (detectedLocationRef.current?.countryCode) {
      return detectedLocationRef.current.countryCode;
    }
    return fallbackCountryCode || 'MX';
  }, []); // ✅ Sin dependencies, usa ref

  return {
    ...state,
    requestLocation,
    clearLocation,
    checkPermission,
    getCountryCodeForCurrency,
  };
}

export default useGeolocation;
