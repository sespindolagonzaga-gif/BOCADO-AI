import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  requestNotificationPermission, 
  onForegroundMessage, 
  areNotificationsSupported,
  trackEvent 
} from '../firebaseConfig';
import { logger } from '../utils/logger';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db, serverTimestamp } from '../firebaseConfig';
import { useTranslation } from '../contexts/I18nContext';

export interface SmartReminder {
  id: string;
  type: 'meal' | 'pantry' | 'rating' | 'engagement' | 'custom';
  title: string;
  body: string;
  hour: number;
  minute: number;
  enabled: boolean;
  condition?: 'always' | 'pantry_empty' | 'pending_ratings' | 'inactive_user';
  lastShown?: string; // ISO date string
  minDaysBetween?: number; // Días mínimos entre repeticiones
}

interface UseSmartNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | null;
  token: string | null;
  reminders: SmartReminder[];
  isLoading: boolean;
  requestPermission: () => Promise<boolean>;
  updateReminder: (id: string, updates: Partial<SmartReminder>) => void;
  toggleReminder: (id: string) => void;
  checkAndShowReminders: () => void;
  sendTestNotification: () => Promise<boolean>;
  pendingRatingsCount: number;
  daysSinceLastPantryUpdate: number | null;
  daysSinceLastAppUse: number;
}

const createDefaultReminders = (t: (key: string) => string): SmartReminder[] => [
  // Recordatorios de comidas
  {
    id: 'breakfast',
    type: 'meal',
    title: t('notifications.breakfast.title'),
    body: t('notifications.breakfast.body'),
    hour: 8,
    minute: 0,
    enabled: true,
    condition: 'always',
    minDaysBetween: 1,
  },
  {
    id: 'lunch',
    type: 'meal',
    title: t('notifications.lunch.title'),
    body: t('notifications.lunch.body'),
    hour: 13,
    minute: 30,
    enabled: true,
    condition: 'always',
    minDaysBetween: 1,
  },
  {
    id: 'dinner',
    type: 'meal',
    title: t('notifications.dinner.title'),
    body: t('notifications.dinner.body'),
    hour: 19,
    minute: 30,
    enabled: true,
    condition: 'always',
    minDaysBetween: 1,
  },
  // Recordatorios inteligentes
  {
    id: 'pantry_update',
    type: 'pantry',
    title: t('notifications.pantryUpdate.title'),
    body: t('notifications.pantryUpdate.body'),
    hour: 10,
    minute: 0,
    enabled: true,
    condition: 'pantry_empty',
    minDaysBetween: 3,
  },
  {
    id: 'rate_recipes',
    type: 'rating',
    title: t('notifications.rateRecipes.title'),
    body: t('notifications.rateRecipes.body'),
    hour: 15,
    minute: 0,
    enabled: true,
    condition: 'pending_ratings',
    minDaysBetween: 2,
  },
  {
    id: 'come_back',
    type: 'engagement',
    title: t('notifications.comeBack.title'),
    body: t('notifications.comeBack.body'),
    hour: 12,
    minute: 0,
    enabled: true,
    condition: 'inactive_user',
    minDaysBetween: 7,
  },
];

const STORAGE_KEY = 'bocado_smart_reminders';
const LAST_ACTIVE_KEY = 'bocado_last_active';
const RATINGS_SHOWN_KEY = 'bocado_ratings_shown';

export const useSmartNotifications = (userUid: string | undefined): UseSmartNotificationsReturn => {
  const { t } = useTranslation();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reminders, setReminders] = useState<SmartReminder[]>(() => createDefaultReminders(t));
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [daysSinceLastPantryUpdate, setDaysSinceLastPantryUpdate] = useState<number | null>(null);
  const [daysSinceLastAppUse, setDaysSinceLastAppUse] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedSettingsRef = useRef(false);

  // Limpiar datos corruptos con claves de traducción al inicio
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasCorruptedData = parsed.some((item: any) => 
          item.title?.includes('notifications.') || 
          item.title?.includes('notificacions.') ||
          item.body?.includes('notifications.') || 
          item.body?.includes('notificacions.')
        );
        
        if (hasCorruptedData) {
          logger.info('Limpiando datos de notificaciones corruptos');
          localStorage.removeItem(STORAGE_KEY);
          // Regenerar con traducciones correctas
          const defaultReminders = createDefaultReminders(t);
          setReminders(defaultReminders);
        }
      } catch (e) {
        logger.error('Error verificando datos de notificaciones:', e);
      }
    }
  }, [t]); // Al montar y cuando cambian las traducciones

  // Verificar soporte
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await areNotificationsSupported();
      setIsSupported(supported);
      if (supported && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };
    checkSupport();
  }, []);

  const getTimeZone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  };

  const saveSettings = useCallback(async (updates: Partial<Record<string, any>>) => {
    if (!userUid) return;
    try {
      await setDoc(doc(db, 'notification_settings', userUid), {
        userId: userUid,
        timezone: getTimeZone(),
        updatedAt: serverTimestamp(),
        ...updates,
      }, { merge: true });
    } catch (error) {
      logger.warn('Error guardando settings de notificaciones:', error);
    }
  }, [userUid]);

  const hashToken = async (value: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);

    if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  };

  const saveToken = useCallback(async (tokenValue: string) => {
    if (!userUid) return;
    try {
      const tokenId = await hashToken(tokenValue);
      const tokenRef = doc(collection(db, 'notification_settings', userUid, 'tokens'), tokenId);
      await setDoc(tokenRef, {
        token: tokenValue,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timezone: getTimeZone(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await saveSettings({ hasToken: true, tokenUpdatedAt: serverTimestamp() });
    } catch (error) {
      logger.warn('Error guardando token FCM:', error);
    }
  }, [userUid, saveSettings]);

  // Cargar recordatorios guardados
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const defaultReminders = createDefaultReminders(t);
        setReminders(defaultReminders.map(defaultRem => {
          const savedItem = parsed.find((r: SmartReminder) => r.id === defaultRem.id);
          return savedItem ? { ...defaultRem, ...savedItem } : defaultRem;
        }));
      } catch (e) {
        logger.error('Error cargando recordatorios:', e);
      }
    }
  }, [t]);

  // Actualizar traducciones de recordatorios cuando cambie el idioma
  useEffect(() => {
    setReminders(prev => {
      const defaultReminders = createDefaultReminders(t);
      return prev.map(reminder => {
        const defaultRem = defaultReminders.find(dr => dr.id === reminder.id);
        if (defaultRem) {
          // Detectar si el título es una clave de traducción (contiene "notifications.")
          const isTranslationKey = reminder.title.includes('notifications.') || reminder.title.includes('notificacions.');
          
          // Mantener configuraciones del usuario pero actualizar traducciones
          return {
            ...reminder,
            title: defaultRem.title,
            body: defaultRem.body,
          };
        }
        return reminder;
      });
    });
  }, [t]);

  // Cargar settings desde Firestore (fuente primaria)
  useEffect(() => {
    if (!userUid) return;

    const loadSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'notification_settings', userUid));
        if (docSnap.exists()) {
          const data = docSnap.data() as { reminders?: SmartReminder[] };
          if (Array.isArray(data.reminders)) {
            const defaultReminders = createDefaultReminders(t);
            setReminders(defaultReminders.map(defaultRem => {
              const savedItem = data.reminders?.find(r => r.id === defaultRem.id);
              return savedItem ? { ...defaultRem, ...savedItem } : defaultRem;
            }));
          }
        }
      } catch (error) {
        logger.warn('Error cargando settings de notificaciones:', error);
      } finally {
        hasLoadedSettingsRef.current = true;
      }
    };

    loadSettings();
  }, [userUid]);

  // Guardar recordatorios
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  // Persistir recordatorios en Firestore
  useEffect(() => {
    if (!userUid || !hasLoadedSettingsRef.current) return;
    saveSettings({ reminders });
  }, [reminders, userUid, saveSettings]);

  // Actualizar última actividad
  useEffect(() => {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_ACTIVE_KEY, now);
    
    // Calcular días desde última actividad
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    if (lastActive) {
      const days = Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));
      setDaysSinceLastAppUse(days);
    }
    if (userUid) {
      saveSettings({ lastActiveAt: serverTimestamp() });
    }
  }, [userUid, saveSettings]);

  // Consultar datos para condiciones inteligentes
  useEffect(() => {
    if (!userUid) return;

    const checkSmartConditions = async () => {
      try {
        // Verificar despensa
        const pantryDoc = await getDoc(doc(db, 'user_pantry', userUid));
        if (pantryDoc.exists()) {
          const data = pantryDoc.data();
          const lastUpdated = data.lastUpdated?.toDate?.() || data.lastUpdated;
          if (lastUpdated) {
            const days = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
            setDaysSinceLastPantryUpdate(days);
          } else {
            setDaysSinceLastPantryUpdate(null);
          }
          
          // Considerar "vacía" si tiene menos de 3 items o no se actualiza en 7 días
          const items = data.items || [];
          const isEffectivelyEmpty = items.length < 3 || (lastUpdated && 
            (Date.now() - new Date(lastUpdated).getTime()) > 7 * 24 * 60 * 60 * 1000);
          
          if (!isEffectivelyEmpty) {
            // Si la despensa no está vacía, no mostrar recordatorio de despensa
            setReminders(prev => prev.map(r => 
              r.id === 'pantry_update' ? { ...r, condition: 'pantry_empty', enabled: r.enabled } : r
            ));
          }
        } else {
          setDaysSinceLastPantryUpdate(null);
        }

        // Verificar recetas guardadas sin calificar (simulado - en producción consultar Firestore)
        const savedRatings = localStorage.getItem(RATINGS_SHOWN_KEY);
        const ratingsCount = savedRatings ? JSON.parse(savedRatings).length : 0;
        // Estimar pendientes (esto debería venir de Firestore en producción)
          const pending = Math.max(0, 3 - ratingsCount);
          setPendingRatingsCount(pending);
          if (userUid) {
            saveSettings({ pendingRatingsCount: pending });
          }

      } catch (error) {
        logger.error('Error consultando condiciones inteligentes:', error);
      }
    };

    checkSmartConditions();
    // Revisar cada 5 minutos
    const interval = setInterval(checkSmartConditions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userUid]);

  // Verificar y mostrar recordatorios
  const checkAndShowReminders = useCallback(() => {
    if (!isSupported || permission !== 'granted') return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const today = now.toDateString();

    reminders.forEach(reminder => {
      if (!reminder.enabled) return;

      const reminderTime = reminder.hour * 60 + reminder.minute;
      
      // Ventana de tiempo para mostrar notificaciones (30 minutos después de la hora)
      const WINDOW_MINUTES = 30;
      const isWithinWindow = currentTime >= reminderTime && currentTime <= (reminderTime + WINDOW_MINUTES);
      const isTimeExact = currentTime === reminderTime;
      
      // Mostrar si es el momento exacto O si estamos dentro de la ventana y no se ha mostrado hoy
      if (isTimeExact || isWithinWindow) {
        // Verificar si ya se mostró hoy
        const lastShown = reminder.lastShown;
        const lastShownDate = lastShown ? new Date(lastShown).toDateString() : null;
        
        if (lastShownDate === today) return;

        // Verificar condiciones especiales
        let shouldShow = true;
        
        switch (reminder.condition) {
          case 'pantry_empty':
            // Mostrar si despensa vacía o no actualizada en 7 días
            shouldShow = daysSinceLastPantryUpdate === null || daysSinceLastPantryUpdate >= 3;
            break;
            
          case 'pending_ratings':
            // Mostrar si hay ratings pendientes
            shouldShow = pendingRatingsCount > 0;
            break;
            
          case 'inactive_user':
            // Mostrar si usuario inactivo por 3+ días
            shouldShow = daysSinceLastAppUse >= 3;
            break;
            
          case 'always':
          default:
            shouldShow = true;
        }

        // Verificar días mínimos entre repeticiones
        if (shouldShow && reminder.lastShown && reminder.minDaysBetween) {
          const daysSinceLast = Math.floor(
            (now.getTime() - new Date(reminder.lastShown).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceLast < reminder.minDaysBetween) {
            shouldShow = false;
          }
        }

        if (shouldShow) {
          const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
          const suppressLocal = isVisible && !!token;
          if (suppressLocal) return;

          // Mostrar notificación local solo si no hay push activo en foreground
          new Notification(reminder.title, {
            body: reminder.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: reminder.id,
            requireInteraction: false,
            data: { type: reminder.type, id: reminder.id },
          });

          // Actualizar lastShown
          setReminders(prev => prev.map(r => 
            r.id === reminder.id ? { ...r, lastShown: now.toISOString() } : r
          ));

          trackEvent('smart_reminder_shown', {
            reminder_id: reminder.id,
            type: reminder.type,
            condition: reminder.condition,
            is_within_window: isWithinWindow && !isTimeExact,
          });
        }
      }
    });
  }, [isSupported, permission, reminders, daysSinceLastPantryUpdate, pendingRatingsCount, daysSinceLastAppUse, token]);

  // Loop de verificación cada minuto
  useEffect(() => {
    if (!isSupported || permission !== 'granted') return;

    intervalRef.current = setInterval(checkAndShowReminders, 60000);
    checkAndShowReminders(); // Verificar inmediatamente

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSupported, permission, checkAndShowReminders]);

  // Escuchar mensajes en primer plano
  useEffect(() => {
    if (!isSupported) return;
    
    onForegroundMessage((payload) => {
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || t('notifications.appName'), {
          body: payload.notification?.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: payload.data?.type || 'default',
          data: payload.data,
        });
      }
    });
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    try {
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        setToken(fcmToken);
        setPermission('granted');
        await saveToken(fcmToken);
        logger.info('Permiso de notificaciones concedido');
        return true;
      } else {
        setPermission(Notification.permission);
        return false;
      }
    } catch (error) {
      logger.error('Error solicitando permiso:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, saveToken]);

  const updateReminder = useCallback((id: string, updates: Partial<SmartReminder>) => {
    setReminders(prev => prev.map(r => 
      r.id === id ? { ...r, ...updates } : r
    ));
    trackEvent('smart_reminder_updated', { id, ...updates });
  }, []);

  const toggleReminder = useCallback((id: string) => {
    setReminders(prev => prev.map(r => {
      if (r.id === id) {
        const newEnabled = !r.enabled;
        trackEvent('smart_reminder_toggled', { id, enabled: newEnabled });
        
        // Si se está activando, limpiar lastShown para permitir notificación hoy
        if (newEnabled) {
          return { ...r, enabled: newEnabled, lastShown: undefined };
        }
        
        return { ...r, enabled: newEnabled };
      }
      return r;
    }));
  }, []);

  /**
   * Envía una notificación de prueba inmediata
   */
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!isSupported || permission !== 'granted') {
      logger.warn('No se puede enviar notificación de prueba: permiso no concedido');
      return false;
    }

    try {
      new Notification(t('notifications.testNotification.title'), {
        body: t('notifications.testNotification.body'),
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'test',
        requireInteraction: false,
      });

      trackEvent('notification_test_sent');
      logger.info('Notificación de prueba enviada');
      return true;
    } catch (error) {
      logger.error('Error enviando notificación de prueba:', error);
      return false;
    }
  }, [isSupported, permission]);

  return {
    isSupported,
    permission,
    token,
    reminders,
    isLoading,
    requestPermission,
    updateReminder,
    toggleReminder,
    checkAndShowReminders,
    sendTestNotification,
    pendingRatingsCount,
    daysSinceLastPantryUpdate,
    daysSinceLastAppUse,
  };
};

export default useSmartNotifications;
