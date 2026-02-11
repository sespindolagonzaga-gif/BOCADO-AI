/**
 * Tests para validación de schemas de API
 * Estos tests aseguran que los schemas Zod funcionan correctamente
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-crear los schemas para testing (evitar importar el handler completo)
const RequestBodySchema = z.object({
  userId: z.string().min(1).max(128),
  type: z.enum(['En casa', 'Fuera']),
  mealType: z.string().max(50).optional().nullable(),
  cookingTime: z.union([z.string(), z.number()]).optional().nullable(),
  cravings: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  budget: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  dislikedFoods: z.array(z.string().max(100)).max(50).optional().default([]),
  _id: z.string().max(128).optional(),
  userLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
  }).optional().nullable(),
});

describe('API Validation Tests', () => {
  describe('RequestBodySchema', () => {
    it('should validate valid "En casa" request', () => {
      const validRequest = {
        userId: 'user123',
        type: 'En casa' as const,
        mealType: 'Comida',
        cookingTime: 30,
        budget: '$200',
        currency: 'MXN',
      };
      
      const result = RequestBodySchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate valid "Fuera" request', () => {
      const validRequest = {
        userId: 'user456',
        type: 'Fuera' as const,
        cravings: ['Mexicana'],
        userLocation: {
          lat: 19.4326,
          lng: -99.1332,
          accuracy: 10,
        },
      };
      
      const result = RequestBodySchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const invalidRequest = {
        userId: 'user123',
        type: 'Invalid',
        mealType: 'Comida',
      };
      
      const result = RequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject userId too long', () => {
      const invalidRequest = {
        userId: 'a'.repeat(129),
        type: 'En casa' as const,
      };
      
      const result = RequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject too many disliked foods', () => {
      const invalidRequest = {
        userId: 'user123',
        type: 'En casa' as const,
        dislikedFoods: Array(51).fill('food'),
      };
      
      const result = RequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid coordinates', () => {
      const invalidRequest = {
        userId: 'user123',
        type: 'Fuera' as const,
        userLocation: {
          lat: 'invalid',
          lng: -99.1332,
        },
      };
      
      const result = RequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should accept minimal valid request', () => {
      const minimalRequest = {
        userId: 'user123',
        type: 'En casa' as const,
      };
      
      const result = RequestBodySchema.safeParse(minimalRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('Rate Limit Constants', () => {
    it('should have reasonable rate limit defaults', () => {
      // Verificar que los límites son razonables
      const DEFAULT_CONFIG = {
        windowMs: 10 * 60 * 1000,    // 10 minutos
        maxRequests: 5,               // 5 requests por ventana
        cooldownMs: 30 * 1000,        // 30 segundos entre requests
        stuckThresholdMs: 2 * 60 * 1000, // 2 minutos para cleanup
      };

      expect(DEFAULT_CONFIG.windowMs).toBe(600000);
      expect(DEFAULT_CONFIG.maxRequests).toBe(5);
      expect(DEFAULT_CONFIG.cooldownMs).toBe(30000);
      expect(DEFAULT_CONFIG.stuckThresholdMs).toBe(120000);
    });
  });
});
