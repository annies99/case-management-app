// frontend/services/auth.js

import { APP_SECRET, BASE_API_URL } from '../config/constants';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken, setAuthToken } from './authService';

// simulate network delay
const delay = ms => new Promise(res => setTimeout(res, ms));

function findToken(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (/token/i.test(k) && v && typeof v === 'string') return v;
    const nested = findToken(v);
    if (nested) return nested;
  }
  return null;
}

function findTokenInHeaders(headers) {
  for (const [k, v] of headers.entries()) {
    if (/token/i.test(k) && v) return v;
  }
  return null;
}

function extractToken(str) {
  if (!str) return null;
  const match = String(str).match(/token["'=:\s]+([A-Za-z0-9._-]+)/i);
  return match ? match[1] : null;
}

// Default login credentials placeholder; intentionally left blank so fields are empty on load
export const DEFAULT_LOGIN = {
  email: '',
  password: '',
  phone: '',
};

export async function signIn(email, password) {
  await delay(300);
  return { userId: 'dummy-user' };
}

export async function signUp({ firstName, lastName, phone, password }) {
  console.log('[auth.signUp] request', { phone, firstName, lastName });
  const body = new URLSearchParams();
  body.append('FirstName', firstName);
  body.append('LastName', lastName);
  if (phone) body.append('PhoneNo', phone);
  body.append('PhoneNo', phone);
  body.append('Password', password);
  body.append('UserId', phone);

  try {
    const res = await fetch(`${BASE_API_URL}/user/register`, {
      method: 'POST',
      headers: {
        AppSecret: APP_SECRET,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch { /* not JSON */ }

    if (!res.ok || data.success === false) {
      const msg = data.message || text || 'Request failed';
      // surface specific duplicate-user errors for caller
      if (/exist/i.test(msg)) {
        throw new Error('User already exists');
      }
      throw new Error(msg);
    }

    const headers = res.headers;
    const headerToken = findTokenInHeaders(headers);
    const cookieToken = headers
      .get('set-cookie')
      ?.match(/token=([^;]+)/i)?.[1];

    let token =
      findToken(data) ||
      headerToken ||
      cookieToken ||
      extractToken(text) ||
      'dummy-token';

    token = String(token);
    await SecureStore.setItemAsync('sessionToken', token);
    await AsyncStorage.setItem('authToken', token);
    setAuthToken(token);
    return { ...(data || {}), Token: token };
  } catch (err) {
    console.warn('[auth.signUp] failed:', err.message);
    throw err;
  }
}

export async function createChart(info) {
  console.log('[auth.createChart] info', info);
  const body = new URLSearchParams();
  if (info.Salutation)        body.append('Salutation', info.Salutation);
  body.append('FirstName',      info.FirstName);
  body.append('LastName',       info.LastName);
  if (info.MiddleName)         body.append('MiddleName', info.MiddleName);
  if (info.Gender)             body.append('Gender', info.Gender);
  if (info.BirthDate)          body.append('BirthDate', info.BirthDate);
  if (info.Phone)              body.append('Phone', info.Phone);
  if (info.DaytimePhone)       body.append('DaytimePhone', info.DaytimePhone);
  if (info.Address1)           body.append('Address1', info.Address1);
  if (info.Address2 !== undefined) body.append('Address2', info.Address2);
  if (info.City)               body.append('City', info.City);
  if (info.State)              body.append('State', info.State);
  if (info.Zip)                body.append('Zip', info.Zip);
  if (info.Email)              body.append('Email', info.Email);
  if (info.Id)                 body.append('Id', info.Id);
  body.append('PracticeKey',   String(info.PracticeKey ?? 1));
  body.append('ProviderKey',   String(info.ProviderKey ?? 1));
  if (info.PreferredLanguage)  body.append('PreferredLanguage', info.PreferredLanguage);

  const token =
    getAuthToken() ||
    (await AsyncStorage.getItem('authToken')) ||
    (await SecureStore.getItemAsync('sessionToken'));
  console.log('[auth.createChart] using token', token);

  const res = await fetch(`${BASE_API_URL}/patient/create`, {
    method: 'POST',
    headers: {
      AppSecret: APP_SECRET,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(token ? { Token: token } : {}),
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Request failed');
  }

  const data = await res.json().catch(() => ({}));
  console.log('[auth.createChart] response', data);
  return data;
}

export async function savePatientInfo(info, sessionToken) {
  let token =
    sessionToken ||
    (await SecureStore.getItemAsync('sessionToken')) ||
    (await AsyncStorage.getItem('authToken'));
  if (!token) {
    console.log('Missing session token; using dummy token');
    token = 'dummy-token';
  }

  const body = new URLSearchParams();
  Object.entries(info).forEach(([k, v]) => {
    if (v != null) body.append(k, String(v));
  });

  try {
    const res = await fetch(`${BASE_API_URL}/patient/create`, {
      method: 'POST',
      headers: {
        AppSecret: APP_SECRET,
        Token: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Request failed');
    }

    return res.json().catch(() => ({}));
  } catch (err) {
    console.log('savePatientInfo failed:', err.message);
    return {};
  }
}
