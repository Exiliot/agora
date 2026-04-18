import type { NotificationView } from '@agora/shared';

export const nativePermissionState = (): 'default' | 'granted' | 'denied' => {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
};

export const requestNativePermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
};

export const maybeFireNative = (_n: NotificationView): void => {
  // Full behaviour lands in Task 17 (cross-tab dedup, visibility check).
};
