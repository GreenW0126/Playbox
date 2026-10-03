export type AppVariant = 'local' | 'public';

export const APP_VARIANT: AppVariant = import.meta.env.VITE_APP_VARIANT === 'local'
  ? 'local'
  : 'public';

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Playbox';
export const STORAGE_PREFIX = import.meta.env.VITE_STORAGE_PREFIX || 'playbox';

export const IS_PUBLIC_DEMO = APP_VARIANT === 'public';
