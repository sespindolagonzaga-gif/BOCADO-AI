import React from 'react';
import { usePWA } from '../hooks/usePWA';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useTranslation } from '../contexts/I18nContext';

interface PWABannerProps {
  showInstall?: boolean;
}

/**
 * Banner para mostrar notificaciones PWA:
 * - Instalación disponible
 * - Actualización disponible
 * - Estado offline
 */
const PWABanner: React.FC<PWABannerProps> = ({ showInstall = true }) => {
  const { t } = useTranslation();
  const { 
    isInstallable, 
    isOffline, 
    updateAvailable, 
    install, 
    updateApp,
    installPrompt,
    isInstalled,
    isIOS,
    isAndroid,
  } = usePWA();

  const [dismissedInstall, setDismissedInstall] = React.useState(() => {
    // Persistir dismiss con expiración de 3 días para no ser demasiado agresivo
    const dismissedAt = localStorage.getItem('pwa-install-dismissed-at');
    if (!dismissedAt) return false;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    if (elapsed > THREE_DAYS_MS) {
      localStorage.removeItem('pwa-install-dismissed-at');
      return false;
    }
    return true;
  });
  
  const [dismissedUpdate, setDismissedUpdate] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleDismissInstall = () => {
    setDismissedInstall(true);
    localStorage.setItem('pwa-install-dismissed-at', String(Date.now()));
  };

  const handleDismissUpdate = () => {
    setDismissedUpdate(true);
  };

  // No mostrar si no hay nada que notificar o si fue descartado
  const isMobile = isIOS || isAndroid;
  const showInstallBanner = showInstall && isInstallable && !isInstalled && !dismissedInstall;

  if ((!showInstallBanner && !isOffline && !updateAvailable) || (updateAvailable && dismissedUpdate)) {
    return null;
  }

  // Banner de actualización (prioridad alta)
  if (updateAvailable && !dismissedUpdate) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 bg-blue-500 text-white px-safe pt-safe py-3 shadow-lg">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm font-medium">
              {t('pwaBanner.updateAvailable')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isUpdating) return;
                setIsUpdating(true);
                updateApp();
              }}
              disabled={isUpdating}
              className="px-3 py-1.5 bg-white text-blue-500 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                t('pwaBanner.update')
              )}
            </button>
            <button
              onClick={handleDismissUpdate}
              className="p-1.5 hover:bg-blue-600 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner de instalación
  if (showInstallBanner) {
    const isManualInstall = isIOS && !installPrompt;

    // Determinar el texto descriptivo según plataforma
    const getInstallDescription = () => {
      if (isManualInstall) return t('pwaBanner.installManualIOS');
      if (!isMobile) return t('pwaBanner.installDesktop');
      return t('pwaBanner.installQuickAccess');
    };

    return (
      <div className="absolute bottom-4 left-4 right-4 z-50 bg-bocado-green text-white px-safe py-4 rounded-2xl shadow-xl max-w-sm md:max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{t('pwaBanner.installTitle')}</p>
              <p className="text-xs text-white/80">
                {getInstallDescription()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isManualInstall ? (
              <button
                onClick={handleDismissInstall}
                className="px-3 py-2 bg-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/20 transition-colors"
              >
                {t('pwaBanner.understood')}
              </button>
            ) : (
              <button
                onClick={install}
                className="px-4 py-2 bg-white text-bocado-green text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t('pwaBanner.install')}
              </button>
            )}
            <button
              onClick={handleDismissInstall}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner offline
  if (isOffline) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-white px-safe pt-safe py-2">
        <div className="flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span className="text-xs font-medium">
            {t('pwaBanner.offlineMessage')}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default PWABanner;
