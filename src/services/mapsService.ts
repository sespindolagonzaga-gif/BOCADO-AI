import { env } from '../environment/env';
import { logger } from '../utils/logger';
import { auth } from '../firebaseConfig';

// ✅ NUEVO: Usar proxy en lugar de API key directa
const MAPS_PROXY_URL = env.api.recommendationUrl.replace('/recommend', '/maps-proxy');

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city: string;
  country: string;
  countryCode: string;
}

/**
 * Helper para hacer requests al proxy
 * Algunas acciones (autocomplete) funcionan sin auth para permitir registro
 */
async function proxyRequest(action: string, params: Record<string, any>): Promise<any> {
  const user = auth.currentUser;
  
  // Autocomplete funciona sin auth (para flujo de registro)
  // Las demás acciones requieren autenticación
  const requiresAuth = action !== 'autocomplete';
  
  if (requiresAuth && !user) {
    throw new Error('Usuario no autenticado');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Agregar token si hay usuario autenticado
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(MAPS_PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Busca ciudades usando Google Places Autocomplete API (vía proxy)
 */
export async function searchCities(
  query: string,
  countryCode?: string
): Promise<PlacePrediction[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  try {
    const data = await proxyRequest('autocomplete', {
      query: query.trim(),
      countryCode: countryCode?.toLowerCase(),
    });

    return (data.predictions || []).map((prediction: any) => ({
      placeId: prediction.placeId,
      description: prediction.description,
      mainText: prediction.mainText,
      secondaryText: prediction.secondaryText,
      types: prediction.types || [],
    }));
  } catch (error) {
    logger.error('Error searching cities:', error);
    return [];
  }
}

/**
 * Obtiene detalles de un lugar (incluyendo coordenadas) (vía proxy)
 */
export async function getPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
  try {
    const data = await proxyRequest('placeDetails', { placeId });

    return {
      lat: data.location.lat,
      lng: data.location.lng,
      formattedAddress: data.formattedAddress,
      city: data.city || '',
      country: data.country || '',
      countryCode: data.countryCode || '',
    };
  } catch (error) {
    logger.error('Error getting place details:', error);
    return null;
  }
}

/**
 * Geocodifica una dirección/cadena de búsqueda (vía proxy)
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const data = await proxyRequest('geocode', { address: address.trim() });

    return {
      lat: data.location.lat,
      lng: data.location.lng,
      formattedAddress: data.formattedAddress,
      city: data.city || '',
      country: data.country || '',
      countryCode: data.countryCode || '',
    };
  } catch (error) {
    logger.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * Geocodificación inversa: coordenadas a dirección (vía proxy)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const data = await proxyRequest('reverseGeocode', { lat, lng });

    return {
      lat: data.location.lat,
      lng: data.location.lng,
      formattedAddress: data.formattedAddress,
      city: data.city || '',
      country: data.country || '',
      countryCode: data.countryCode || '',
    };
  } catch (error) {
    logger.error('Error reverse geocoding:', error);
    return null;
  }
}

/**
 * @deprecated La API key ya no se usa en el frontend.
 * Las llamadas ahora van al proxy protegido.
 * Mantener esta función por compatibilidad si alguien la usa.
 */
export function getMapsApiKey(): null {
  logger.warn('getMapsApiKey está deprecada. Usar las funciones del proxy.');
  return null;
}
