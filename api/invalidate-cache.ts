/**
 * 💰 FINOPS: Cache Invalidation API
 * 
 * Endpoint para invalidar cache cuando el usuario actualiza datos:
 * - Profile actualizado → invalidar profileCache
 * - Pantry modificada → invalidar pantryCache
 * - Historial borrado → invalidar historyCache
 * 
 * POST /api/invalidate-cache  (requiere auth Bearer token)
 * Body: { type?: 'profile' | 'pantry' | 'history' | 'all' }
 * 
 * GET /api/invalidate-cache   (requiere x-api-key o dev mode)
 * Retorna estadísticas del cache
 */

import { getApps, cert, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { profileCache, pantryCache, historyCache, getCacheStats } from './utils/cache.js';

// ============================================
// FIREBASE ADMIN INIT (reutiliza si ya está inicializado)
// ============================================
if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey.trim());
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.warn('[invalidate-cache] FIREBASE_SERVICE_ACCOUNT_KEY not set - auth will fail');
    }
  } catch (error) {
    console.error('[invalidate-cache] Firebase init error:', error);
  }
}

// ============================================
// CORS
// ============================================
const ALLOWED_ORIGINS = [
  // Producción
  'https://bocado-ai.vercel.app',
  'https://bocado.app',
  'https://www.bocado.app',
  'https://app.bocado.app',
  // Desarrollo
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // same-origin requests
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  return ALLOWED_ORIGINS.includes(origin);
};

// ============================================
// HANDLER (Vercel Serverless)
// ============================================
export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;

  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ============================================
  // GET: Cache stats (dev or api-key protected)
  // ============================================
  if (req.method === 'GET') {
    try {
      const isDev = process.env.NODE_ENV === 'development';
      const providedKey = req.headers['x-api-key'];
      const expectedKey = process.env.CACHE_STATS_KEY;
      const hasValidKey = Boolean(expectedKey && providedKey && providedKey === expectedKey);

      if (!isDev && !hasValidKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const stats = getCacheStats();
      return res.status(200).json({ stats, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Cache] Stats error:', error);
      return res.status(500).json({ error: 'Failed to get cache stats' });
    }
  }

  // ============================================
  // POST: Invalidate cache (requires Firebase auth)
  // ============================================
  if (req.method === 'POST') {
    // Autenticar con Firebase Auth token
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const tokenMatch = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    const idToken = tokenMatch?.[1];

    if (!idToken) {
      return res.status(401).json({ error: 'Auth token required' });
    }

    let userId: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      userId = decoded.uid;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    try {
      const { type = 'all' } = req.body || {};
      const invalidated: string[] = [];

      switch (type) {
        case 'profile':
          profileCache.del(userId);
          invalidated.push('profile');
          break;
        case 'pantry':
          pantryCache.del(userId);
          invalidated.push('pantry');
          break;
        case 'history':
          historyCache.del(userId);
          invalidated.push('history');
          break;
        case 'all':
        default:
          profileCache.del(userId);
          pantryCache.del(userId);
          historyCache.del(userId);
          invalidated.push('profile', 'pantry', 'history');
          break;
      }

      console.log(`[Cache] Invalidated ${invalidated.join(', ')} for user ${userId.substring(0, 8)}...`);

      return res.status(200).json({
        success: true,
        userId: userId.substring(0, 8) + '...',
        invalidated,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[Cache] Invalidation error:', error);
      return res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
