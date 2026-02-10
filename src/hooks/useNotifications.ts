import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  requestNotificationPermission, 
  onForegroundMessage, 
  areNotificationsSupported,
  trackEvent 
} from '../firebaseConfig';
import { logger } from '../utils/logger';

export interface NotificationSchedule {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  enabled: boolean;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'custom';
}

interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | null;
  token: string | null;
  schedules: NotificationSchedule[];
  isLoading: boolean;
  requestPermission: () => Promise<boolean>;
  updateSchedule: (id: string, updates: Partial<NotificationSchedule>) => void;
  addSchedule: (schedule: Omit<NotificationSchedule, 'id'>) => void;
  removeSchedule: (id: string) => void;
  toggleSchedule: (id: string) => void;
  lastMessage: any | null;
}

const DEFAULT_SCHEDULES: NotificationSchedule[] = [
  {
    id: 'breakfast',
    title: '🌅 Buen día',
    body: '¿Qué te parece un desayuno nutritivo para empezar?',
    hour: 8,
    minute: 0,
    enabled: false,
    type: 'breakfast',
  },
  {
    id: 'lunch',
    title: '🍽️ Hora de comer',
    body: 'Descubre recetas deliciosas para tu almuerzo',
    hour: 13,
    minute: 30,
    enabled: false,
    type: 'lunch',
  },
  {
    id: 'dinner',
    title: '🌙 Cena ligera',
    body: 'Te sugerimos opciones saludables para cenar',
    hour: 19,
    minute: 30,
    enabled: false,
    type: 'dinner',
  },
];

const STORAGE_KEY = 'bocado_notification_schedules';

export const useNotifications = (): UseNotificationsReturn => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>(DEFAULT_SCHEDULES);
  const [isLoading, setIsLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Verificar soporte al inicio
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

  // Cargar horarios guardados
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge con defaults para asegurar nuevos campos
        setSchedules(DEFAULT_SCHEDULES.map(defaultSchedule => {
          const saved = parsed.find((s: NotificationSchedule) => s.id === defaultSchedule.id);
          return saved ? { ...defaultSchedule, ...saved } : defaultSchedule;
        }));
      } catch (e) {
        logger.error('Error cargando horarios de notificaciones:', e);
      }
    }
  }, []);

  // Guardar horarios cuando cambien
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  }, [schedules]);

  // Escuchar mensajes en primer plano
  useEffect(() => {
    if (!isSupported) return;
    
    onForegroundMessage((payload) => {
      setLastMessage(payload);
      // Mostrar notificación local si la app está abierta
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'Bocado', {
          body: payload.notification?.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: payload.data?.type || 'default',
        });
      }
    });
  }, [isSupported]);

  // Verificar recordatorios cada minuto
  useEffect(() => {
    if (!isSupported || permission !== 'granted') return;

    const checkSchedules = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      schedules.forEach(schedule => {
        if (!schedule.enabled) return;
        
        const scheduleTime = schedule.hour * 60 + schedule.minute;
        
        // Si es el momento exacto (dentro del minuto actual)
        if (currentTime === scheduleTime) {
          // Verificar si ya mostramos esta notificación hoy
          const lastShownKey = `last_notification_${schedule.id}`;
          const lastShown = localStorage.getItem(lastShownKey);
          const today = now.toDateString();
          
          if (lastShown !== today) {
            localStorage.setItem(lastShownKey, today);
            
            // Mostrar notificación local
            new Notification(schedule.title, {
              body: schedule.body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              tag: schedule.id,
              requireInteraction: false,
            });
            
            trackEvent('notification_local_reminder_shown', {
              type: schedule.type,
              hour: schedule.hour,
            });
          }
        }
      });
    };

    // Verificar cada minuto
    intervalRef.current = setInterval(checkSchedules, 60000);
    
    // Verificar inmediatamente también
    checkSchedules();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSupported, permission, schedules]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    try {
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        setToken(fcmToken);
        setPermission('granted');
        
        // Guardar token en Firestore (opcional, para notificaciones push desde servidor)
        // await saveTokenToFirestore(fcmToken);
        
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

  const updateSchedule = useCallback((id: string, updates: Partial<NotificationSchedule>) => {
    setSchedules(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
    trackEvent('notification_schedule_updated', { id, ...updates });
  }, []);

  const addSchedule = useCallback((schedule: Omit<NotificationSchedule, 'id'>) => {
    const newSchedule = {
      ...schedule,
      id: `custom_${Date.now()}`,
    };
    setSchedules(prev => [...prev, newSchedule]);
    trackEvent('notification_schedule_added', { type: schedule.type });
  }, []);

  const removeSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    trackEvent('notification_schedule_removed', { id });
  }, []);

  const toggleSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.map(s => {
      if (s.id === id) {
        const newEnabled = !s.enabled;
        trackEvent('notification_schedule_toggled', { id, enabled: newEnabled });
        return { ...s, enabled: newEnabled };
      }
      return s;
    }));
  }, []);

  return {
    isSupported,
    permission,
    token,
    schedules,
    isLoading,
    requestPermission,
    updateSchedule,
    addSchedule,
    removeSchedule,
    toggleSchedule,
    lastMessage,
  };
};

export default useNotifications;
