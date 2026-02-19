/**
 * 🔒 Rate Limiting Utilities para Vercel Functions
 * 
 * Nota: El rate limiting distribuido usa Firestore transactions en recommend.ts
 * Este archivo proporciona helpers para extraer y validar límites
 */

/**
 * Tipo helper para rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

/**
 * Helper para extraer IP del request en Vercel Functions
 * Maneja: x-forwarded-for, x-real-ip, connection.remoteAddress
 */
export const getClientIP = (req: any): string => {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.headers?.["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

/**
 * Helper para extraer User ID del request
 * Busca en: body.userId, params.userId, decoded token user.uid
 */
export const getUserID = (req: any, decodedToken?: any): string | null => {
  // Prioridad: decoded token > body > params
  if (decodedToken?.uid) {
    return decodedToken.uid;
  }
  if (req.body?.userId) {
    return req.body.userId;
  }
  if ((req as any).params?.userId) {
    return (req as any).params.userId;
  }
  return null;
};

/**
 * Límites predefinidos para diferentes tipos de peticiones
 * Usados por la lógica de rate limiting en recommend.ts
 */
export const RATE_LIMIT_CONFIG = {
  /**
   * Rate limit global por IP (DDoS protection)
   * 100 requests en 15 minutos
   */
  global: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    cooldownMs: 1000,
  },

  /**
   * Rate limit estricto para recomendaciones (protege costos de Gemini)
   * 5 requests en 10 minutos por usuario
   */
  recommendations: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
    cooldownMs: 30 * 1000, // 30 segundos entre requests
  },

  /**
   * Rate limit para Google Maps API
   * 50 requests en 10 minutos por usuario
   */
  maps: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 50,
    cooldownMs: 5 * 1000,
  },

  /**
   * Rate limit para autenticación (brute force protection)
   * 5 intentos fallidos en 15 minutos por IP
   */
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    cooldownMs: 0,
  },
};

/**
 * Helper para formatear error de rate limit como respuesta JSON
 */
export const createRateLimitResponse = (
  config: keyof typeof RATE_LIMIT_CONFIG,
  secondsUntilReset?: number
) => {
  const messages: Record<string, string> = {
    global: "Demasiadas peticiones. Intenta más tarde.",
    recommendations:
      "Límite de recomendaciones alcanzado. Intenta en unos momentos.",
    maps: "Límite de búsquedas alcanzado. Intenta más tarde.",
    auth: "Demasiados intentos fallidos. Intenta más tarde.",
  };

  return {
    error: "Rate Limited",
    message: messages[config],
    retryAfter: secondsUntilReset || RATE_LIMIT_CONFIG[config].windowMs / 1000,
    code: `RATE_LIMITED_${config.toUpperCase()}`,
  };
};

/**
 * Helper para extraer rate limit info de response headers
 * (usado si implementamos headers de rate limit)
 */
export const extractRateLimitInfo = (
  headers: Record<string, any>
): RateLimitInfo => ({
  limit: parseInt(headers["ratelimit-limit"] || "0"),
  current: parseInt(headers["ratelimit-current"] || "0"),
  remaining: parseInt(headers["ratelimit-remaining"] || "0"),
  resetTime: new Date((headers["ratelimit-reset"] || 0) * 1000),
});

/**
 * Formatear segundos a mensaje legible
 * ej: 125 segundos -> "2 minutos y 5 segundos"
 */
export const formatSecondsUntilReset = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? "s" : ""}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  let message = `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  if (remainingSeconds > 0) {
    message += ` y ${remainingSeconds} segundo${remainingSeconds !== 1 ? "s" : ""}`;
  }
  return message;
};

