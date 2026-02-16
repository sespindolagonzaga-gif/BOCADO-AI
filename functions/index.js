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
const messaging = admin.messaging();

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
 * Enviar recordatorios push (comidas + inteligentes)
 * Corre cada minuto y respeta zona horaria del usuario
 */
exports.sendNotificationReminders = functions.pubsub
  .schedule('*/1 * * * *')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      const settingsSnap = await db.collection('notification_settings').get();
      if (settingsSnap.empty) {
        console.log('No notification settings to process');
        return null;
      }

      const now = new Date();

      const getLocalTimeParts = (date, timeZone) => {
        let formatter;
        let usedFallback = false;
        try {
          formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch (error) {
          usedFallback = true;
          formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        const parts = formatter.formatToParts(date);
        const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
        const year = getPart('year');
        const month = getPart('month');
        const day = getPart('day');
        const hour = parseInt(getPart('hour'), 10);
        const minute = parseInt(getPart('minute'), 10);
        return { hour, minute, dateKey: `${year}-${month}-${day}`, usedFallback };
      };

      const daysSince = (timestamp) => {
        if (!timestamp) return null;
        const last = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffMs = Date.now() - last.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      };

      for (const docSnap of settingsSnap.docs) {
        try {
          const settings = docSnap.data();
          const reminders = Array.isArray(settings.reminders) ? settings.reminders : [];
          const timeZone = settings.timezone || 'UTC';
          const { hour, minute, dateKey, usedFallback } = getLocalTimeParts(now, timeZone);
          if (usedFallback) {
            console.warn(`Invalid timezone for ${docSnap.id}: ${timeZone}, using UTC`);
          }

          if (reminders.length === 0) continue;

          const pantryDoc = await db.collection('user_pantry').doc(docSnap.id).get();
          const pantryData = pantryDoc.exists ? pantryDoc.data() : null;
          const pantryItems = pantryData?.items || [];
          const pantryLastUpdated = pantryData?.lastUpdated || null;
          const pantryDays = daysSince(pantryLastUpdated);
          const pantryEmpty = pantryItems.length < 3 || (pantryDays !== null && pantryDays >= 7);

          const pendingRatingsCount = settings.pendingRatingsCount || 0;
          const inactiveDays = daysSince(settings.lastActiveAt);

          const tokensSnap = await db.collection('notification_settings').doc(docSnap.id).collection('tokens').get();
          let tokens = tokensSnap.docs.map(d => d.id).filter(Boolean);
          if (tokens.length === 0) continue;

          const remindersToSend = reminders.filter((reminder) => {
            if (!reminder?.enabled) return false;
            if (reminder.hour !== hour || reminder.minute !== minute) return false;

            if (reminder.lastShown) {
              const lastDate = getLocalTimeParts(new Date(reminder.lastShown), timeZone).dateKey;
              if (lastDate === dateKey) return false;
            }

            if (reminder.minDaysBetween && reminder.lastShown) {
              const lastDays = daysSince(reminder.lastShown);
              if (lastDays !== null && lastDays < reminder.minDaysBetween) return false;
            }

            switch (reminder.condition) {
              case 'pantry_empty':
                return pantryEmpty;
              case 'pending_ratings':
                return pendingRatingsCount > 0;
              case 'inactive_user':
                return inactiveDays !== null && inactiveDays >= 3;
              case 'always':
              default:
                return true;
            }
          });

          if (remindersToSend.length === 0) continue;

          let remindersState = reminders.slice();

          for (const reminder of remindersToSend) {
            if (tokens.length === 0) {
              break;
            }

            const response = await messaging.sendEachForMulticast({
              tokens,
              notification: {
                title: reminder.title || 'Bocado',
                body: reminder.body || 'Tienes un nuevo recordatorio',
              },
              data: {
                type: reminder.type || 'custom',
                id: reminder.id || 'reminder',
              },
            });

            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const code = resp.error?.code || '';
                if (code.includes('invalid-registration-token') || code.includes('registration-token-not-registered')) {
                  invalidTokens.push(tokens[idx]);
                }
              }
            });

            if (invalidTokens.length > 0) {
              const batch = db.batch();
              invalidTokens.forEach((token) => {
                const tokenRef = db.collection('notification_settings').doc(docSnap.id).collection('tokens').doc(token);
                batch.delete(tokenRef);
              });
              await batch.commit();
              tokens = tokens.filter(token => !invalidTokens.includes(token));
            }

            remindersState = remindersState.map((item) => {
              if (!item?.enabled || item.id !== reminder.id) return item;
              return { ...item, lastShown: new Date().toISOString() };
            });
          }

          await db.collection('notification_settings').doc(docSnap.id).set({
            reminders: remindersState,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error(`Error processing notifications for ${docSnap.id}:`, error);
        }
      }

      return null;
    } catch (err) {
      console.error('Error in sendNotificationReminders:', err);
      throw err;
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
    'airtable_cache',  // ✅ NUEVO: Caché de Airtable
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

/**
 * Cleanup old airtable_cache documents
 * Runs every 6 hours
 * Deletes documents older than 24 hours (TTL de 6h + buffer de 18h)
 */
exports.cleanupAirtableCache = functions.pubsub
  .schedule('0 */6 * * *') // Every 6 hours
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const cutoffDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    );

    let deletedCount = 0;
    let batchCount = 0;
    const MAX_BATCHES = 5;

    try {
      while (batchCount < MAX_BATCHES) {
        const snapshot = await db.collection('airtable_cache')
          .where('expiresAt', '<', cutoffDate)
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
        
        console.log(`Batch ${batchCount}: Deleted ${snapshot.size} expired airtable cache entries`);
        
        if (batchCount < MAX_BATCHES) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Total deleted from airtable_cache: ${deletedCount} in ${batchCount} batches`);
      return { deleted: deletedCount, batches: batchCount };
    } catch (error) {
      console.error('Error cleaning up airtable cache:', error);
      throw error;
    }
});
