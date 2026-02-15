/**
 * 💰 FINOPS: Cache Invalidation API
 * 
 * Endpoint para invalidar cache cuando el usuario actualiza datos:
 * - Profile actualizado → invalidar profileCache
 * - Pantry modificada → invalidar pantryCache
 * - Historial borrado → invalidar historyCache
 * 
 * POST /api/invalidate-cache
 * Body: { userId: string, type?: 'profile' | 'pantry' | 'history' | 'all' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { profileCache, pantryCache, historyCache, getCacheStats } from './utils/cache.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId, type = 'all' } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required and must be a string' },
        { status: 400 }
      );
    }

    let invalidated: string[] = [];

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

    return NextResponse.json({
      success: true,
      userId: userId.substring(0, 8) + '...',
      invalidated,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Cache] Invalidation error:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invalidate-cache
 * Retorna estadísticas del cache (para debugging)
 */
export async function GET(req: NextRequest) {
  try {
    const stats = getCacheStats();
    
    return NextResponse.json({
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Cache] Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats', details: error.message },
      { status: 500 }
    );
  }
}
