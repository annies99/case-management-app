// frontend/services/providerService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_API_URL, APP_SECRET } from '../config/constants';

/** @typedef {import('../types/api').ReferringProviderResponse} ReferringProviderResponse */

const PROVIDER_LIST_PATH = '/provider/list';

const normalizeKey = value => {
  if (value == null) return '';
  return String(value).trim();
};

/**
 * @returns {Promise<ReferringProviderResponse[]>}
 */
export async function fetchProvidersForLocation(locationKey) {
  const trimmedKey = normalizeKey(locationKey);
  if (!trimmedKey) {
    throw new Error('A location is required to load providers.');
  }

  const token = (await AsyncStorage.getItem('authToken'))?.trim();

  const headers = {
    Accept: 'application/json',
    AppSecret: APP_SECRET,
    ...(token ? { Token: token } : {}),
  };
  const params = { locationKey: trimmedKey, practiceKey: '4' };
  const logHeaders = { ...headers };
  if (logHeaders.Token) logHeaders.Token = '[redacted]';
  if (logHeaders.AppSecret) logHeaders.AppSecret = '[redacted]';
  console.log('[providers] GET /provider/list', { params, headers: logHeaders });

  let response;
  try {
    response = await axios.get(`${LOCATION_API_URL}${PROVIDER_LIST_PATH}`, {
      headers,
      params,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new Error('Unable to reach the provider service. Please try again.');
  }

  const { status, data } = response;

  if (status >= 200 && status < 300 && (data?.success ?? true)) {
    const list = Array.isArray(data?.result)
      ? data.result
      : Array.isArray(data?.providers)
      ? data.providers
      : Array.isArray(data)
      ? data
      : [];

    console.log('[providers] fetched', list.length, 'records');
    return list;
  }

  const message = data?.message || `Failed to load providers (HTTP ${status})`;
  throw new Error(message);
}

export default fetchProvidersForLocation;
