/**
 * Firebase Cloud Functions for Bocado AI
 * 
 * These functions handle data cleanup and maintenance tasks
 * that should run automatically in the background.
 * 
 * Deployment:
 * 1. npm install -g firebase-tools
 * 2. firebase login
 * 3. firebase init functions (if not already done)
 * 4. Copy this file to functions/index.js or import it
 * 5. firebase deploy --only functions
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Cleanup old user_interactions documents
 * Runs every day at 3:00 AM
 * Deletes documents older than 30 days
 */
exports.cleanupOldInteractions = functions.pubsub
  .schedule('0 3 * * *') // Every day at 3:00 AM
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    );

    const batch = db.batch();
    let deletedCount = 0;
    
    try {
      // Query for old documents
      const snapshot = await db.collection('user_interactions')
        .where('createdAt', '<', cutoffDate)
        .limit(500) // Process in batches
        .get();

      if (snapshot.empty) {
        console.log('No old interactions to clean up');
        return null;
      }

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();
      console.log(`Deleted ${deletedCount} old interactions`);
      
      return { deleted: deletedCount };
    } catch (error) {
      console.error('Error cleaning up interactions:', error);
      throw error;
    }
  });

/**
 * Cleanup old IP rate limit documents
 * Runs every hour
 * Deletes documents older than 24 hours
 */
exports.cleanupOldIPRateLimits = functions.pubsub
  .schedule('0 * * * *') // Every hour
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    );

    const batch = db.batch();
    let deletedCount = 0;

    try {
      const snapshot = await db.collection('ip_rate_limits')
        .where('updatedAt', '<', cutoffDate)
        .limit(500)
        .get();

      if (snapshot.empty) {
        console.log('No old IP rate limits to clean up');
        return null;
      }

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();
      console.log(`Deleted ${deletedCount} old IP rate limits`);
      
      return { deleted: deletedCount };
    } catch (error) {
      console.error('Error cleaning up IP rate limits:', error);
      throw error;
    }
  });

/**
 * Archive old user history (feedback)
 * Runs every week on Sunday at 2:00 AM
 * Moves documents older than 90 days to an archive collection
 */
exports.archiveOldUserHistory = functions.pubsub
  .schedule('0 2 * * 0') // Every Sunday at 2:00 AM
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    );

    const batch = db.batch();
    let archivedCount = 0;

    try {
      const snapshot = await db.collection('user_history')
        .where('createdAt', '<', cutoffDate)
        .limit(500)
        .get();

      if (snapshot.empty) {
        console.log('No old user history to archive');
        return null;
      }

      // Move to archive collection
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const archiveRef = db.collection('user_history_archive').doc(doc.id);
        
        batch.set(archiveRef, {
          ...data,
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.delete(doc.ref);
        archivedCount++;
      });

      await batch.commit();
      console.log(`Archived ${archivedCount} old user history items`);
      
      return { archived: archivedCount };
    } catch (error) {
      console.error('Error archiving user history:', error);
      throw error;
    }
  });

/**
 * Cleanup old historial_recetas documents
 * Runs every day at 4:00 AM
 * Deletes documents older than 90 days
 */
exports.cleanupOldHistorialRecetas = functions.pubsub
  .schedule('0 4 * * *') // Every day at 4:00 AM
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    );

    let deletedCount = 0;
    let batchCount = 0;
    const MAX_BATCHES = 10; // Safety limit

    try {
      // Process in multiple batches if needed
      while (batchCount < MAX_BATCHES) {
        const snapshot = await db.collection('historial_recetas')
          .where('fecha_creacion', '<', cutoffDate)
          .limit(500)
          .get();

        if (snapshot.empty) {
          break;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });

        await batch.commit();
        batchCount++;
        
        console.log(`Batch ${batchCount}: Deleted ${snapshot.size} documents from historial_recetas`);
        
        // Small delay between batches
        if (batchCount < MAX_BATCHES) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Total deleted from historial_recetas: ${deletedCount} in ${batchCount} batches`);
      return { deleted: deletedCount, batches: batchCount };
    } catch (error) {
      console.error('Error cleaning up historial_recetas:', error);
      throw error;
    }
  });

/**
 * Cleanup old historial_recomendaciones documents
 * Runs every day at 4:30 AM
 * Deletes documents older than 90 days
 */
exports.cleanupOldHistorialRecomendaciones = functions.pubsub
  .schedule('30 4 * * *') // Every day at 4:30 AM
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    );

    let deletedCount = 0;
    let batchCount = 0;
    const MAX_BATCHES = 10;

    try {
      while (batchCount < MAX_BATCHES) {
        const snapshot = await db.collection('historial_recomendaciones')
          .where('fecha_creacion', '<', cutoffDate)
          .limit(500)
          .get();

        if (snapshot.empty) {
          break;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });

        await batch.commit();
        batchCount++;
        
        console.log(`Batch ${batchCount}: Deleted ${snapshot.size} documents from historial_recomendaciones`);
        
        if (batchCount < MAX_BATCHES) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Total deleted from historial_recomendaciones: ${deletedCount} in ${batchCount} batches`);
      return { deleted: deletedCount, batches: batchCount };
    } catch (error) {
      console.error('Error cleaning up historial_recomendaciones:', error);
      throw error;
    }
  });

/**
 * Cleanup old maps proxy cache
 * Runs every hour
 * Deletes expired cache entries
 */
exports.cleanupMapsProxyCache = functions.pubsub
  .schedule('0 * * * *') // Every hour
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    let deletedCount = 0;

    try {
      // Note: This requires an index on expiresAt
      // For now, we'll query without ordering and check in code
      const snapshot = await db.collection('maps_proxy_cache')
        .limit(500)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const expiresAt = data?.expiresAt?.toMillis?.() || 0;
        
        if (Date.now() > expiresAt) {
          batch.delete(doc.ref);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      console.log(`Deleted ${deletedCount} expired cache entries`);
      return { deleted: deletedCount };
    } catch (error) {
      console.error('Error cleaning up maps proxy cache:', error);
      throw error;
    }
  });

/**
 * HTTP function to manually trigger cleanup (for admin use)
 * Requires authentication + admin claim
 */
exports.manualCleanup = functions.https.onCall(async (data, context) => {
  // Verify authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Enforce admin claim (set via Firebase Auth custom claims)
  const isAdmin = Boolean(context.auth.token?.admin);
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Must be admin');
  }

  const { collection, days } = data || {};

  // Validate inputs to prevent abuse
  const allowedCollections = new Set([
    'user_interactions',
    'ip_rate_limits',
    'user_history',
    'user_history_archive',
    'historial_recetas',
    'historial_recomendaciones',
    'maps_proxy_cache',
    'maps_proxy_rate_limits',
  ]);

  if (!collection || typeof collection !== 'string' || !allowedCollections.has(collection)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid collection');
  }

  const daysNumber = Number(days);
  if (!Number.isFinite(daysNumber) || daysNumber < 1 || daysNumber > 365) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid days range');
  }

  const cutoffDate = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000)
  );

  try {
    const snapshot = await db.collection(collection)
      .where('createdAt', '<', cutoffDate)
      .limit(1000)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    return { 
      success: true, 
      deleted: snapshot.size,
      collection,
      olderThan: `${daysNumber} days`
    };
  } catch (error) {
    console.error('Error in manual cleanup:', error);
    throw new functions.https.HttpsError('internal', 'Cleanup failed');
  }
});
