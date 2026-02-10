import { env } from '../environment/env';
import { logger } from '../utils/logger';

const GOOGLE_MAPS_API_KEY = env.api.googleMapsApiKey;

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
 * Busca ciudades usando Google Places Autocomplete API
 */
export async function searchCities(
  query: string,
  countryCode?: string
): Promise<PlacePrediction[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  try {
    // Construir component restrictions si se especifica país
    const components = countryCode ? `&components=country:${countryCode.toLowerCase()}` : '';
    
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query
    )}&types=(cities)&language=es${components}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error('Google Places API error:', data.status, data.error_message);
      return [];
    }

    return (data.predictions || []).map((prediction: any) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting?.main_text || prediction.terms?.[0]?.value || '',
      secondaryText: prediction.structured_formatting?.secondary_text || '',
      types: prediction.types || [],
    }));
  } catch (error) {
    logger.error('Error searching cities:', error);
    return [];
  }
}

/**
 * Obtiene detalles de un lugar (incluyendo coordenadas)
 */
export async function getPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,address_components&language=es&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      logger.error('Google Place Details API error:', data.status);
      return null;
    }

    const result = data.result;
    const location = result.geometry?.location;

    if (!location) {
      return null;
    }

    // Extraer ciudad y país de los componentes de dirección
    let city = '';
    let country = '';
    let countryCode = '';

    for (const component of result.address_components || []) {
      const types = component.types;
      
      if (types.includes('locality') || types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
      if (types.includes('country')) {
        country = component.long_name;
        countryCode = component.short_name;
      }
    }

    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      city: city || '',
      country: country || '',
      countryCode: countryCode || '',
    };
  } catch (error) {
    logger.error('Error getting place details:', error);
    return null;
  }
}

/**
 * Geocodifica una dirección/cadena de búsqueda
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&language=es&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      logger.error('Google Geocoding API error:', data.status);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry?.location;

    if (!location) {
      return null;
    }

    // Extraer ciudad y país
    let city = '';
    let country = '';
    let countryCode = '';

    for (const component of result.address_components) {
      const types = component.types;
      
      if (types.includes('locality') || types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
      if (types.includes('country')) {
        country = component.long_name;
        countryCode = component.short_name;
      }
    }

    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      city: city || '',
      country: country || '',
      countryCode: countryCode || '',
    };
  } catch (error) {
    logger.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * Geocodificación inversa: coordenadas a dirección
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=es&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      logger.error('Google Reverse Geocoding API error:', data.status);
      return null;
    }

    const result = data.results[0];

    // Extraer ciudad y país
    let city = '';
    let country = '';
    let countryCode = '';

    for (const component of result.address_components) {
      const types = component.types;
      
      if (types.includes('locality') || types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
      if (types.includes('country')) {
        country = component.long_name;
        countryCode = component.short_name;
      }
    }

    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      city: city || '',
      country: country || '',
      countryCode: countryCode || '',
    };
  } catch (error) {
    logger.error('Error reverse geocoding:', error);
    return null;
  }
}
