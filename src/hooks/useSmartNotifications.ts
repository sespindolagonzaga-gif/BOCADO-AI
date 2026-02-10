import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  requestNotificationPermission, 
  onForegroundMessage, 
  areNotificationsSupported,
  trackEvent 
} from '../firebaseConfig';
import { logger } from '../utils/logger';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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
  pendingRatingsCount: number;
  daysSinceLastPantryUpdate: number | null;
  daysSinceLastAppUse: number;
}

const DEFAULT_REMINDERS: SmartReminder[] = [
  // Recordatorios de comidas
  {
    id: 'breakfast',
    type: 'meal',
    title: '🌅 Buenos días',
    body: '¿Ya pensaste qué desayunar hoy? Descubre opciones nutritivas',
    hour: 8,
    minute: 0,
    enabled: true,
    condition: 'always',
    minDaysBetween: 1,
  },
  {
    id: 'lunch',
    type: 'meal',
    title: '🍽️ Hora de comer',
    body: 'Te sugerimos recetas deliciosas basadas en tu despensa',
    hour: 13,
    minute: 30,
    enabled: true,
    condition: 'always',
    minDaysBetween: 1,
  },
  {
    id: 'dinner',
    type: 'meal',
    title: '🌙 Cena saludable',
    body: 'Termina el día con una cena ligera y nutritiva',
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
    title: '🥑 Actualiza tu despensa',
    body: '¿Tienes nuevos ingredientes? Actualiza "Mi Cocina" para mejores recomendaciones',
    hour: 10,
    minute: 0,
    enabled: true,
    condition: 'pantry_empty',
    minDaysBetween: 3,
  },
  {
    id: 'rate_recipes',
    type: 'rating',
    title: '⭐ ¿Qué te pareció?',
    body: 'Califica las recetas y restaurantes que probaste para mejorar tus recomendaciones',
    hour: 15,
    minute: 0,
    enabled: true,
    condition: 'pending_ratings',
    minDaysBetween: 2,
  },
  {
    id: 'come_back',
    type: 'engagement',
    title: '🥗 Te extrañamos',
    body: 'Descubre nuevas recetas perfectas para ti. ¡Abre Bocado!',
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
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reminders, setReminders] = useState<SmartReminder[]>(DEFAULT_REMINDERS);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [daysSinceLastPantryUpdate, setDaysSinceLastPantryUpdate] = useState<number | null>(null);
  const [daysSinceLastAppUse, setDaysSinceLastAppUse] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cargar recordatorios guardados
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setReminders(DEFAULT_REMINDERS.map(defaultRem => {
          const saved = parsed.find((r: SmartReminder) => r.id === defaultRem.id);
          return saved ? { ...defaultRem, ...saved } : defaultRem;
        }));
      } catch (e) {
        logger.error('Error cargando recordatorios:', e);
      }
    }
  }, []);

  // Guardar recordatorios
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

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
  }, []);

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
        setPendingRatingsCount(Math.max(0, 3 - ratingsCount));

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
      
      // Si es el momento exacto
      if (currentTime === reminderTime) {
        // Verificar si ya se mostró hoy
        const lastShown = reminder.lastShown;
        const today = now.toDateString();
        
        if (lastShown === today) return;

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
          // Mostrar notificación
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
          });
        }
      }
    });
  }, [isSupported, permission, reminders, daysSinceLastPantryUpdate, pendingRatingsCount, daysSinceLastAppUse]);

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
        new Notification(payload.notification?.title || 'Bocado', {
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
  }, [isSupported]);

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
        return { ...r, enabled: newEnabled };
      }
      return r;
    }));
  }, []);

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
    pendingRatingsCount,
    daysSinceLastPantryUpdate,
    daysSinceLastAppUse,
  };
};

export default useSmartNotifications;
