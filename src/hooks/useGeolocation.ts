import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';
import { trackEvent } from '../firebaseConfig';

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationState {
  position: GeolocationPosition | null;
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
      (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        
        setState({
          position: newPosition,
          loading: false,
          error: null,
          permission: 'granted',
        });
        
        trackEvent('geolocation_success', { 
          accuracy: position.coords.accuracy,
          lat: Math.round(position.coords.latitude * 100) / 100, // Aproximado para privacidad
          lng: Math.round(position.coords.longitude * 100) / 100,
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

  // Limpiar posición
  const clearLocation = useCallback(() => {
    setState({
      position: null,
      loading: false,
      error: null,
      permission: 'unknown',
    });
    trackEvent('geolocation_cleared');
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocation,
    checkPermission,
  };
}

export default useGeolocation;
