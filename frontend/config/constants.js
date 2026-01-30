// frontend/config/constants.js
import Constants from 'expo-constants';

const extras =
  Constants.expoConfig?.extra ||
  Constants.manifest?.extra ||
  {};

const firstDefined = (...keys) => {
  for (const key of keys) {
    const value = extras?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
};

const requireConfig = (label, ...keys) => {
  const value = firstDefined(...keys);
  if (value === undefined) {
    throw new Error(
      `Missing configuration for ${label}. Provide ${keys.join(
        ' or '
      )} via app.config.js (Expo extra) or your .env file.`
    );
  }
  return value;
};

export const BASE_API_URL = requireConfig('API_BASE_URL', 'apiBaseUrl', 'API_BASE_URL');

export const SLOT_API_URL = requireConfig('SLOT_API_URL', 'slotApiUrl', 'SLOT_API_URL');

export const FIRST_AVAILABLE_SLOTS_API_URL =
  firstDefined(
    'firstAvailableSlotsApiUrl',
    'FIRST_AVAILABLE_SLOTS_API_URL',
    'slotApiUrl',
    'SLOT_API_URL'
  ) || SLOT_API_URL;

export const WIDGET_API_URL = requireConfig('WIDGET_API_URL', 'widgetApiUrl', 'WIDGET_API_URL');

export const LOCATION_API_URL = requireConfig(
  'LOCATION_API_URL',
  'locationApiUrl',
  'LOCATION_API_URL'
);

export const APP_SECRET = requireConfig(
  'EXTERNAL_APP_SECRET',
  'externalAppSecret',
  'EXTERNAL_APP_SECRET'
);

export const API_URL =
  firstDefined('internalApiUrl', 'INTERNAL_API_URL', 'apiUrl', 'API_URL') ||
  'http://localhost:5000/api';

export const GOOGLE_MAPS_API_KEY = requireConfig(
  'GOOGLE_MAPS_API_KEY',
  'googleMapsApiKey',
  'GOOGLE_MAPS_API_KEY'
);

// Default which IC to show on first mount; runtime toggle can override this.
export const INITIAL_CONSULTATION_VARIANT =
  firstDefined('initialConsultationVariant', 'icVariant', 'IC_VARIANT') || 'v1';
