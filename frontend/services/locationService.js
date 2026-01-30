// frontend/services/locationService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_API_URL, APP_SECRET } from '../config/constants';

/** @typedef {import('../types/api').LocationResponse} LocationResponse */

const LOCATION_LIST_PATH = '/location/list';

const resolveExternalKey = location => {
  const value =
    location?.ExternalIPMKey ??
    location?.LocationExternalIPMKey ??
    location?.externalIPMKey ??
    location?.externalIpmKey ??
    location?.LocationExternalIpmKey ??
    location?.ExternalKey ??
    location?.externalKey ??
    0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

export function getExternalKey(location) {
  return resolveExternalKey(location);
}

/**
 * @returns {Promise<LocationResponse[]>}
 */
export async function fetchPracticeLocations() {
  const token = (await AsyncStorage.getItem('authToken'))?.trim();

  const headers = {
    Accept: 'application/json',
    AppSecret: APP_SECRET,
    ...(token ? { Token: token } : {}),
  };
  const params = { practiceKey: '4' };
  console.log('[locations] GET /location/list', { params });

  let response;
  try {
    response = await axios.get(`${LOCATION_API_URL}${LOCATION_LIST_PATH}`, {
      headers,
      params,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new Error('Unable to reach the location service. Please try again.');
  }

  const { status, data } = response;
  if (status >= 200 && status < 300 && (data?.success ?? true)) {
    const list = Array.isArray(data?.result)
      ? data.result
      : Array.isArray(data?.locations)
      ? data.locations
      : Array.isArray(data)
      ? data
      : [];
    console.log('[locations] fetched', list.length, 'entries');
    return list;
  }

  const message = data?.message || `Failed to load locations (HTTP ${status})`;
  throw new Error(message);
}
