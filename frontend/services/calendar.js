// frontend/services/calendar.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET, FIRST_AVAILABLE_SLOTS_API_URL, LOCATION_API_URL } from '../config/constants';

const client = axios.create({
  baseURL: BASE_API_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json', AppSecret: APP_SECRET },
  timeout: 30000,
});

client.interceptors.request.use(async config => {
  config.headers = config.headers || {};
  if (!config.skipAuth) {
    const token = (await AsyncStorage.getItem('authToken'))?.trim();
    if (token) config.headers.Token = token;
  } else if (config.headers.Token) {
    delete config.headers.Token;
  }

  let logUrl;
  try {
    const baseForUrl = config.baseURL || client.defaults.baseURL || BASE_API_URL;
    logUrl = new URL(config.url || '', baseForUrl);
    if (config.params) {
      Object.entries(config.params).forEach(([k, v]) => {
        if (typeof v !== 'undefined' && v !== null) logUrl.searchParams.append(k, v);
      });
    }
  } catch (err) {
    logUrl = null;
  }

  console.log('[HTTP][REQ]', config.method?.toUpperCase(), logUrl ? logUrl.toString() : config.url || '', {
    headers: {
      Accept: config.headers.Accept ? '<present>' : '<none>',
      AppSecret: config.headers.AppSecret ? '<present>' : '<none>',
      'Content-Type': config.headers['Content-Type'] || '<none>',
      Token: config.headers.Token ? '<present>' : '<none>',
    },
  });

  if (config.skipAuth) delete config.skipAuth;
  return config;
});

// -------------------- helpers --------------------
const pad2 = n => String(n).padStart(2, '0');
const to24 = (d) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}`;
const toYMD = (d) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const parseToDate = (val) => {
  if (val instanceof Date && !isNaN(val)) return val;
  const s = String(val).trim();
  if (/^\d{12}$/.test(s)) {
    const y = +s.slice(0, 4), M = +s.slice(4, 6) - 1, D = +s.slice(6, 8), H = +s.slice(8, 10), m = +s.slice(10, 12);
    return new Date(y, M, D, H, m, 0, 0);
  }
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(s)) return new Date(s); // MM/dd/yyyy HH:mm
  const d = new Date(s);
  if (!isNaN(d)) return d;
  throw new Error(`Bad datetime: ${val}`);
};

const joinUrl = (base, path) => {
  const safeBase = base || '';
  const safePath = path || '';
  const trimmedBase = safeBase.endsWith('/') ? safeBase.slice(0, -1) : safeBase;
  const trimmedPath = safePath.startsWith('/') ? safePath.slice(1) : safePath;
  if (!trimmedBase) return `/${trimmedPath}`;
  if (!trimmedPath) return trimmedBase;
  return `${trimmedBase}/${trimmedPath}`;
};

// -------------------- API calls --------------------

// GET /location/list?providerKey=&practiceKey=
export async function getLocations(providerKey, practiceKey) {
  const params = { practiceKey: String(practiceKey) };
  if (providerKey != null && providerKey !== '') params.providerKey = String(providerKey);

  const url = joinUrl(LOCATION_API_URL, '/location/list');

  let res;
  try {
    res = await client.get(url, {
      params,
      validateStatus: () => true,
      skipAuth: true,
    });
  } catch (err) {
    console.log('[locations][network][error]', err?.message || err);
    throw new Error('Unable to reach the locations service. Please try again.');
  }

  if (res.status >= 200 && res.status < 300 && (res.data?.success ?? true)) {
    const out = (res.data.result || []).map(loc => ({
      key: loc.LocationKey,
      label: loc.LocationDescription,
      address1: loc.Address1,
      address2: loc.Address2,
      city: loc.City,
      state: loc.State,
      zip: loc.Zip,
      externalKey:
        loc.LocationExternalIPMKey ??
        loc.ExternalIPMKey ??
        loc.ExternalKey ??
        null,
    }));
    if (!out.length) throw new Error('No locations found for this account.');
    return out;
  }
  console.log('[locations][error]', res.status, res.data);
  throw new Error(res.data?.message || `HTTP ${res.status}`);
}

// GET /provider/list?locationKey=&practiceKey=
export async function getProviders(locationKey, practiceKey) {
  const params = { practiceKey: String(practiceKey) };
  if (locationKey != null && locationKey !== '') params.locationKey = String(locationKey);

  const res = await client.get('/provider/list', { params, validateStatus: () => true });
  if (res.status >= 200 && res.status < 300 && (res.data?.success ?? true)) {
    const list = (res.data.result || []).map(p => ({ key: p.ProviderKey, label: p.ProviderName }));
    return list;
  }
  console.log('[providers][error]', res.status, res.data);
  throw new Error(res.data?.message || `HTTP ${res.status}`);
}

// GET /appointment/getavailablelocationproviders
export async function getAvailableLocationProviders({ appointmentDateTime, practiceKey = 1, locationKey, providerKey }) {
  const params = {
    appointmentDateTime: String(appointmentDateTime), // must be yyyyMMddHHmm
    practiceKey: String(practiceKey),
  };
  if (locationKey != null && locationKey !== '') params.locationKey = String(locationKey);
  if (providerKey != null && providerKey !== '') params.providerKey = String(providerKey);

  const res = await client.get('/appointment/getavailablelocationproviders', {
    params, headers: { Accept: 'application/json' }, validateStatus: () => true,
  });
  console.log('[avail] GET /appointment/getavailablelocationproviders', params);

  const data = res.data;
  if (res.status >= 200 && res.status < 300 && (data?.success ?? true)) {
    return data.result ?? data;
  }
  const msg = data?.message || `HTTP ${res.status}`;
  console.log('[avail][error]', res.status, data);
  throw new Error(msg);
}

// convenience helper used by older screens
export async function getDoctorsNearby(date = new Date(), practiceKey = 1, locationKey = 1) {
  const appointmentDateTime =
    date.getFullYear().toString() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes());

  const result = await getAvailableLocationProviders({ appointmentDateTime, practiceKey, locationKey });
  return result.map(p => ({
    id: p.ProviderKey || p.providerKey,
    locationKey: p.LocationKey || p.locationKey,
    name: p.ProviderName || p.providerName,
  }));
}

// GET /appointment/getfirstavailableslots?fromDate=&toDate=&practiceKey[=&locationKey][=&providerKey]
export async function getFirstAvailableSlots({ fromDate, toDate, locationKey, providerKey }) {
  const params = {
    fromDate: toYMD(parseToDate(fromDate)),
    toDate: toYMD(parseToDate(toDate)),
    practiceKey: '1',
    ...(locationKey != null && locationKey !== '' ? { locationKey: String(locationKey) } : {}),
    ...(providerKey != null && providerKey !== '' ? { providerKey: String(providerKey) } : {}),
  };
  const url = joinUrl(FIRST_AVAILABLE_SLOTS_API_URL, '/appointment/getfirstavailableslots');
  console.log('[avail] GET', url, params);
  const res = await client.get(url, {
    params,
    headers: { AppSecret: APP_SECRET },
    validateStatus: () => true,
    skipAuth: true,
  });
  if (res.status >= 200 && res.status < 300 && (res.data?.success ?? true)) {
    return res.data?.result ?? res.data;
  }
  console.log('[avail][error]', res.status, res.data);
  throw new Error(res.data?.message || `HTTP ${res.status}`);
}

// GET /appointment/getavailableslots
export async function getSlots(locationKey, providerKey, fromDate, toDate, slotSize = 30, practiceKey = 1) {
  const res = await client.get('/appointment/getavailableslots', {
    params: { locationKey, providerKey, fromDate, toDate, slotSize, practiceKey },
    validateStatus: () => true,
  });
  if (res.status >= 200 && res.status < 300 && (res.data?.success ?? true)) {
    return res.data.result;
  }
  throw new Error(res.data?.message || `HTTP ${res.status}`);
}

// POST /appointment/bookappointment
export async function bookAppointment({ AppointmentDateTime, ProviderKey, LocationKey, PatientKey }) {
  const toYMDhhmmTT = (d) => {
    const yyyy = d.getFullYear();
    const MM = pad2(d.getMonth() + 1);
    const DD = pad2(d.getDate());
    let h = d.getHours();
    const mm = pad2(d.getMinutes());
    const tt = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    const hh = pad2(h);
    return `${yyyy}${MM}${DD}${hh}${mm}${tt}`;
  };

  const toDate = (val) => {
    if (val instanceof Date && !isNaN(val)) return val;
    const s = String(val).trim();
    if (/^\d{12}$/.test(s)) {
      const y = +s.slice(0, 4), M = +s.slice(4, 6), D = +s.slice(6, 8), H = +s.slice(8, 10), m = +s.slice(10, 12);
      return new Date(y, M - 1, D, H, m, 0, 0);
    }
    const parsed = new Date(s);
    if (!isNaN(parsed)) return parsed;
    throw new Error(`Invalid AppointmentDateTime: ${String(val)}`);
  };

  const dt = toDate(AppointmentDateTime);
  if (dt.getTime() <= Date.now()) throw new Error('Selected time is in the past (server rejects past dates).');

  const finalStr = toYMDhhmmTT(dt);
  console.log('[book][final AppointmentDateTime]', finalStr);

  const body = new URLSearchParams({
    AppointmentDateTime: finalStr,
    ProviderKey: String(ProviderKey),
    LocationKey: String(LocationKey),
    PatientKey: String(PatientKey),
    VisitTypeKey: '1',
    VisitDuration: '30',
  }).toString();

  const token = (await AsyncStorage.getItem('authToken'))?.trim();
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    AppSecret: APP_SECRET,
    ...(token ? { Token: token } : {}),
  };

  const res = await client.post('/appointment/bookappointment', body, { headers, validateStatus: () => true });
  if (res.status >= 200 && res.status < 300 && (res.data?.success ?? true)) {
    return res.data.result;
  }
  throw new Error(res.data?.message || `HTTP ${res.status}`);
}

// List appts (unchanged)
export async function listAppointments(patientKey) {
  const res = await client.get('/appointment/list', { params: { patientKey }, validateStatus: () => true });
  if (res.status >= 200 && res.status < 300 && (res.data?.success ?? true)) return res.data.result;
  throw new Error(res.data?.message || `HTTP ${res.status}`);
}
