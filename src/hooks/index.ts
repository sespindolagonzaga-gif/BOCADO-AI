// hooks/index.ts - Exportaciones centralizadas

export { useUserProfile, useUpdateUserProfile } from './useUser';
export { usePWA } from './usePWA';
export { 
  useSavedItems, 
  useToggleSavedItem, 
  useIsItemSaved,
  useAllSavedItems,
  useFeedbackMutation,
  useUserFeedback,
} from './useSavedItems';
export { usePantry } from './usePantry';
export { useRateLimit } from './useRateLimit';
export { useAnalyticsProperties } from './useAnalyticsProperties';
export { useSmartNotifications } from './useSmartNotifications';

// Nuevos hooks para escalabilidad
export {
  usePaginatedFirestoreQuery,
  useVisibilityAwarePolling,
  useChangeDetection,
  type PaginatedResult,
  type PaginationState,
} from './usePaginatedFirestoreQuery';
