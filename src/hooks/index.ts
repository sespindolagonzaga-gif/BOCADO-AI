// hooks/index.ts - Exportaciones centralizadas

export { useUserProfile, useUpdateUserProfile } from './useUser';
export { useProfileDraftWithData, useEditableProfile } from './useProfileDraft';
export { useGeolocation, type GeolocationPosition, type GeolocationState } from './useGeolocation';
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
export { useNetworkStatus, useIsOnline } from './useNetworkStatus';

// Nuevos hooks para escalabilidad
export {
  usePaginatedFirestoreQuery,
  useVisibilityAwarePolling,
  useChangeDetection,
  type PaginatedResult,
  type PaginationState,
} from './usePaginatedFirestoreQuery';

// Feature Flags
export {
  useFeatureFlag,
  useFeatureFlags,
  useMultipleFeatureFlags,
  usePrefetchFeatureFlags,
  useFeatureFlagsSubscription,
  useInvalidateFeatureFlags,
  getFeatureFlagsQueryKey,
  type UseFeatureFlagReturn,
  type UseFeatureFlagsReturn,
} from './useFeatureFlag';
