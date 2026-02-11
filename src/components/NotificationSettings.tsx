import React, { useState } from 'react';
import { useSmartNotifications, SmartReminder } from '../hooks/useSmartNotifications';
import { Bell, BellOff, Clock, CheckCircle } from './icons';
import { trackEvent } from '../firebaseConfig';
import { logger } from '../utils/logger';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  userUid: string;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ isOpen, onClose, userUid }) => {
  const {
    isSupported,
    permission,
    reminders,
    isLoading,
    requestPermission,
    toggleReminder,
    updateReminder,
    sendTestNotification,
    pendingRatingsCount,
    daysSinceLastPantryUpdate,
    daysSinceLastAppUse,
  } = useSmartNotifications(userUid);

  const [testSent, setTestSent] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [activeTab, setActiveTab] = useState<'meals' | 'smart'>('meals');

  if (!isOpen) return null;

  // Si el navegador no soporta notificaciones
  if (!isSupported) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Notificaciones no disponibles</h2>
            <p className="text-sm text-gray-500 mb-6">
              Tu navegador no soporta notificaciones. Prueba con Chrome o Edge en Android/PC.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-bocado-green text-white font-bold py-3 rounded-full"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      trackEvent('notification_settings_permission_granted');
      // Enviar notificación de bienvenida
      setTimeout(async () => {
        await sendTestNotification();
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }, 500);
    }
  };

  const handleTestNotification = async () => {
    const sent = await sendTestNotification();
    if (sent) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  const handleToggleReminder = (id: string) => {
    if (permission !== 'granted') {
      handleRequestPermission();
      return;
    }
    toggleReminder(id);
  };

  const startEditing = (reminder: SmartReminder) => {
    setEditingSchedule(reminder.id);
    const timeString = `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}`;
    setEditTime(timeString);
  };

  const saveEdit = () => {
    if (!editingSchedule || !editTime) return;
    
    const [hours, minutes] = editTime.split(':').map(Number);
    updateReminder(editingSchedule, { hour: hours, minute: minutes });
    setEditingSchedule(null);
    setEditTime('');
  };

  const formatTime = (hour: number, minute: number) => {
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('es', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const mealReminders = reminders.filter(r => r.type === 'meal');
  const smartReminders = reminders.filter(r => r.type !== 'meal');

  const getConditionBadge = (reminder: SmartReminder) => {
    switch (reminder.condition) {
      case 'pantry_empty':
        const days = daysSinceLastPantryUpdate;
        const isEmpty = days === null || days >= 3;
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isEmpty ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
            {isEmpty ? '🥑 Despensa vacía' : '✅ Despensa actualizada'}
          </span>
        );
      case 'pending_ratings':
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full ${pendingRatingsCount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {pendingRatingsCount > 0 ? `⭐ ${pendingRatingsCount} por calificar` : '✅ Todo calificado'}
          </span>
        );
      case 'inactive_user':
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full ${daysSinceLastAppUse >= 3 ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
            {daysSinceLastAppUse >= 3 ? `😴 Inactivo ${daysSinceLastAppUse} días` : '✅ Usuario activo'}
          </span>
        );
      default:
        return null;
    }
  };

  const getReminderIcon = (type: string) => {
    switch (type) {
      case 'breakfast': return '🌅';
      case 'lunch': return '🍽️';
      case 'dinner': return '🌙';
      case 'pantry': return '🥑';
      case 'rating': return '⭐';
      case 'engagement': return '🥗';
      default: return '⏰';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-bocado-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-bocado-green/10 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-bocado-green" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-bocado-dark-green">Recordatorios</h2>
                <p className="text-xs text-bocado-gray">Personaliza tus notificaciones</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bocado-background transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {/* Estado de permisos */}
          {permission !== 'granted' ? (
            <div className="mx-6 mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-800 mb-1">
                    Activa tus recordatorios
                  </p>
                  <p className="text-xs text-blue-600 mb-3 leading-relaxed">
                    Te enviaremos sugerencias de comidas en tus horarios preferidos y recordatorios inteligentes sobre tu despensa.
                  </p>
                  <button
                    onClick={handleRequestPermission}
                    disabled={isLoading}
                    className="w-full text-xs bg-blue-600 text-white font-bold px-4 py-2.5 rounded-full hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
                  >
                    {isLoading ? 'Solicitando...' : '✓ Permitir notificaciones'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-6 mt-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">
                      Notificaciones activas
                    </p>
                    <p className="text-xs text-green-600">
                      Recibirás {reminders.filter(r => r.enabled).length} recordatorios configurados
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={testSent}
                  className="text-xs bg-white text-green-700 font-semibold px-3 py-2 rounded-lg border border-green-200 hover:bg-green-50 disabled:opacity-50 transition-colors"
                >
                  {testSent ? '✓ Enviada' : 'Probar'}
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-bocado-border mt-6">
            <button
              onClick={() => setActiveTab('meals')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'meals' 
                  ? 'text-bocado-green border-b-2 border-bocado-green' 
                  : 'text-bocado-gray'
              }`}
            >
              🍽️ Comidas
            </button>
            <button
              onClick={() => setActiveTab('smart')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'smart' 
                  ? 'text-bocado-green border-b-2 border-bocado-green' 
                  : 'text-bocado-gray'
              }`}
            >
              ✨ Inteligentes
            </button>
          </div>

          {/* Lista de recordatorios */}
          <div className="p-6 space-y-3">
            {activeTab === 'meals' ? (
              <>
                <p className="text-xs text-bocado-gray mb-4">
                  Recibe sugerencias de comidas a tus horarios preferidos
                </p>
                {mealReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      reminder.enabled 
                        ? 'border-bocado-green bg-bocado-green/5' 
                        : 'border-bocado-border bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getReminderIcon(reminder.id)}</span>
                        <div>
                          <p className="font-semibold text-bocado-text text-sm">
                            {reminder.title.replace(/[🌅🍽️🌙]/g, '').trim()}
                          </p>
                          <p className="text-xs text-bocado-gray">{reminder.body}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botón de hora */}
                        {editingSchedule === reminder.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="text-sm border border-bocado-border rounded-lg px-2 py-1"
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              className="text-bocado-green font-bold text-sm px-2"
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(reminder)}
                            className="flex items-center gap-1 text-sm font-medium text-bocado-dark-gray hover:text-bocado-green transition-colors"
                          >
                            <Clock className="w-4 h-4" />
                            {formatTime(reminder.hour, reminder.minute)}
                          </button>
                        )}

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleReminder(reminder.id)}
                          className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${
                            reminder.enabled ? 'bg-bocado-green' : 'bg-gray-300'
                          }`}
                          aria-label={reminder.enabled ? 'Desactivar recordatorio' : 'Activar recordatorio'}
                        >
                          <span
                            className={`absolute left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-out ${
                              reminder.enabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <p className="text-xs text-bocado-gray mb-4">
                  Recordatorios que se activan según tu actividad en la app
                </p>
                {smartReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      reminder.enabled 
                        ? 'border-bocado-green bg-bocado-green/5' 
                        : 'border-bocado-border bg-white opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-2xl">{getReminderIcon(reminder.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-bocado-text text-sm">
                              {reminder.title.replace(/[🥑⭐🥗]/g, '').trim()}
                            </p>
                            {getConditionBadge(reminder)}
                          </div>
                          <p className="text-xs text-bocado-gray mt-1">{reminder.body}</p>
                          <p className="text-xs text-bocado-green mt-2">
                            ⏰ {formatTime(reminder.hour, reminder.minute)}
                          </p>
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggleReminder(reminder.id)}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center flex-shrink-0 ml-2 ${
                          reminder.enabled ? 'bg-bocado-green' : 'bg-gray-300'
                        }`}
                        aria-label={reminder.enabled ? 'Desactivar recordatorio' : 'Activar recordatorio'}
                      >
                        <span
                          className={`absolute left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-out ${
                            reminder.enabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Info sobre cómo funcionan */}
                <div className="mt-4 p-4 bg-bocado-background rounded-xl">
                  <p className="text-xs text-bocado-gray leading-relaxed">
                    <strong>💡 ¿Cómo funcionan?</strong><br />
                    Estos recordatorios solo aparecen cuando se cumplen ciertas condiciones:
                  </p>
                  <ul className="text-xs text-bocado-gray mt-2 space-y-1 ml-4">
                    <li>• <strong>Despensa:</strong> Si no actualizas en 3+ días</li>
                    <li>• <strong>Calificaciones:</strong> Si tienes recetas sin calificar</li>
                    <li>• <strong>Inactividad:</strong> Si no usas la app en 3+ días</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-bocado-border bg-gray-50">
          <div className="flex items-start gap-2 text-xs text-bocado-gray">
            <span className="flex-shrink-0">💡</span>
            <p className="leading-relaxed">
              Las notificaciones funcionan incluso cuando la app está cerrada. 
              Asegúrate de no tener el modo "No molestar" activado en tu dispositivo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
