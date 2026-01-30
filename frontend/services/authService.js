// frontend/services/authService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { BASE_API_URL, APP_SECRET, WIDGET_API_URL } from '../config/constants';

// keep a local copy of the auth token
let cachedToken = null;
export const getAuthToken = () => cachedToken;
export const setAuthToken = token => { cachedToken = token; };

const apiClient = axios.create({
  baseURL: BASE_API_URL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'AppSecret': APP_SECRET,
  },
  timeout: 30000,
});

// automatically attach Token header if present
apiClient.interceptors.request.use(
  async config => {
    let token = cachedToken;
    try {
      if (!token && AsyncStorage?.getItem) {
        token = await AsyncStorage.getItem('authToken');
      }
    } catch (e) {
      console.warn('⚠️ Could not read authToken from AsyncStorage:', e);
    }
    if (token) {
      config.headers.Token = token;
    }
    return config;
  },
  error => Promise.reject(error)
);

// normalize errors
apiClient.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const data = err.response?.data;

    const normalized = { success: false };
    if (status) normalized.status = status;

    if (data && typeof data === 'object') {
      Object.assign(normalized, data);
    }

    let msg;
    if (data) {
      if (typeof data === 'string') {
        msg = data;
      } else {
        msg =
          data.message ||
          data.Message ||
          data.error ||
          data.Error ||
          data.errorMessage ||
          data.MessageDetail;
      }
    }
    if (!msg) msg = err.message;
    if (msg) normalized.message = msg;

    return Promise.reject(normalized);
  }
);

// helper to url-encode a payload
const encode = obj =>
  new URLSearchParams(
    Object.entries(obj).filter(([, v]) => v != null)
  ).toString();

const DATE_TIME_REGEX = /^\d{12}(AM|PM)$/i;

const sanitizeString = value => (typeof value === 'string' ? value.trim() : '');

const formatWidgetDate = value => {
  const trimmed = sanitizeString(value);
  if (!trimmed) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${month}/${day}/${year}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Attempt to parse other inputs into a valid Date to fall back gracefully
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed?.getTime?.())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  }

  return trimmed;
};

const formatWidgetTime = value => {
  const trimmed = sanitizeString(value);
  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const hour = match[1];
    const minute = match[2];
    const meridiem = match[3].toUpperCase();
    return `${hour}:${minute} ${meridiem}`;
  }

  return trimmed;
};

const formatAppointmentDateTime = (date, time) => {
  const trimmedDate = sanitizeString(date);
  const trimmedTime = sanitizeString(time);
  if (!trimmedDate || !trimmedTime) {
    return '';
  }

  const formattedDate = formatWidgetDate(trimmedDate) || trimmedDate;
  return `${formattedDate} ${trimmedTime}`;
};

const extractDateTimeParts = value => {
  const trimmed = sanitizeString(value);
  if (!trimmed) {
    return { date: '', time: '' };
  }

  if (DATE_TIME_REGEX.test(trimmed)) {
    const year = trimmed.slice(0, 4);
    const month = trimmed.slice(4, 6);
    const day = trimmed.slice(6, 8);
    const hour = trimmed.slice(8, 10);
    const minute = trimmed.slice(10, 12);
    const meridiem = trimmed.slice(12).toUpperCase();
    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute} ${meridiem}`,
    };
  }

  const slashMatch = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(AM|PM))$/i);
  if (slashMatch) {
    return {
      date: slashMatch[1],
      time: `${slashMatch[2].replace(/\s+/g, ' ').toUpperCase()}`,
    };
  }

  return { date: '', time: '' };
};

// 1) Register a new user
export async function registerUser(payload) {
  try {
    const { data } = await apiClient.post('/user/register', encode(payload));
    if (!data.success) throw new Error(data.message);
    return data;
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('Our servers are taking a bit longer than usual. Please try again in a moment.');
    }
    throw err;
  }
}

// 2) Authenticate via Basic Auth
export async function authenticateUser({ username, password }) {
  const resp = await apiClient.post(
    '/authentication/authenticate',
    null,
    { auth: { username, password } }
  );
  let token = resp.data;
  if (typeof token === 'object') {
    token = token.Result?.Token || token.token || token.Token;
  }
  if (!token) throw new Error('Authentication failed – no token returned');
  await AsyncStorage.setItem('authToken', token);
  await SecureStore.setItemAsync('sessionToken', token);
  setAuthToken(token);
  return token;
}

// 3) Convenience: register → authenticate
export async function createUserAndAuthenticate(userPayload) {
  await registerUser(userPayload);
  return authenticateUser({
    username: userPayload.UserId,
    password: userPayload.Password,
  });
}

// 4) Create a patient chart
export async function createChart(chartData) {
  try {
    // Always associate new charts with practice 4
    const payload = { ...chartData, PracticeKey: 4 };
    const { data } = await apiClient.post('/patient/create', encode(payload));
    if (!data.success) throw new Error(data.message || 'Chart creation failed');
    return data;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
      throw new Error('Our servers are taking a bit longer than usual. Please try again in a moment.');
    }
    throw err;
  }
}

// 5) Fetch referral source types
export async function getSourceTypes() {
  const { data } = await apiClient.get('/referrals/sourcetypes');
  if (!data.success) throw new Error(data.message || 'Failed to fetch referral types');
  return data.result;
}

// 6) Fetch referral sources for a given type
export async function getSources(type) {
  const actualType = type === 'Hospital' ? 'Employer' : type;
  const endpoints = ['/referrals/source', '/referrals/Source'];
  let lastErr;
  for (const ep of endpoints) {
    try {
      const { data } = await apiClient.get(ep, { params: { Type: actualType } });
      if (data.success) return data.result;
      throw new Error(data.message);
    } catch (err) {
      lastErr = err;
      const msg = err.MessageDetail || err.Message || '';
      if (msg.includes('No action was found') || msg.includes('No HTTP resource was found')) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// 7) Create the Patient record and return its PatientKey
export async function createPatientChart(payload) {
  const params = { ...payload, PracticeKey: 4 };
  const { data } = await apiClient.post('/patient/create', encode(params));
  if (!data.success) throw new Error(data.message || 'Patient creation failed');
  return data.result.PatientKey;
}

// 8) Alternate login endpoint
export async function loginUser({ UserId, Password }) {
  const auth = Buffer.from(`${UserId}:${Password}`).toString('base64');
  const res = await apiClient.post(
    '/authentication/authenticate',
    null,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const token =
    res.headers?.token ||
    res.data?.Token ||
    res.data?.token ||
    res.data?.result?.Token;
  if (!token) throw new Error('Authentication failed – no token returned');
  setAuthToken(token);
  if (AsyncStorage?.setItem) {
    try { await AsyncStorage.setItem('authToken', token); }
    catch (e) { console.warn('Could not save authToken:', e); }
    try { await AsyncStorage.setItem('authUserId', UserId); }
    catch (e) { console.warn('Could not save authUserId:', e); }
  }
  try { await SecureStore.setItemAsync('sessionToken', token); }
  catch (e) { console.warn('Could not save sessionToken:', e); }
  const resultArr = res.data?.result;
  const patientKey = Array.isArray(resultArr) ? resultArr[0] : null;
  if (patientKey && AsyncStorage?.setItem) {
    try { await AsyncStorage.setItem('patientKey', String(patientKey)); }
    catch (e) { console.warn('Could not save patientKey:', e); }
  }
  return { ...res.data, patientKey };
}

// 9) Submit extra patient info
export async function submitPatientInfo(info) {
  const { data } = await apiClient.post('/patient/createChart', encode(info));
  return data;
}

// 10) Book an appointment
export async function bookAppointment({
  AppointmentDateTime,
  ProviderKey,
  LocationKey,
  LocationPrimaryKey,
  PatientKey,
  VisitTypeKey = '1',
  VisitDuration = '30',
  secondaryBooking = null,
}) {
  const normalize = value => {
    if (value == null) return '';
    const str = String(value).trim();
    return str;
  };

  const preferredLocationKey = normalize(LocationKey);
  const fallbackLocationKey = normalize(LocationPrimaryKey);

  const postSecondaryBooking = async payload => {
    if (!payload) {
      return;
    }

    const providerExternalKey = normalize(
      payload.providerExternalKey ?? payload.providerKey
    );
    const providerPrimaryKey = normalize(
      payload.providerPrimaryKey ??
        payload.providerPrimary ??
        payload.providerId ??
        payload.providerInternalKey
    );
    const locationExternalKey = normalize(
      payload.locationExternalKey ?? payload.locationKey
    );
    const locationPrimaryKey = normalize(
      payload.locationPrimaryKey ??
        payload.locationPrimary ??
        payload.locationId ??
        payload.locationInternalKey
    );

    if (
      (!providerExternalKey && !providerPrimaryKey) ||
      (!locationExternalKey && !locationPrimaryKey)
    ) {
      throw new Error('Missing scheduling identifiers required for appointment confirmation.');
    }

    const providerKey =
      sanitizeString(providerExternalKey) || sanitizeString(providerPrimaryKey);
    const locationKey =
      sanitizeString(locationExternalKey) || sanitizeString(locationPrimaryKey);

    let appointmentDate = sanitizeString(payload.appointmentDate);
    let appointmentTime = sanitizeString(payload.appointmentTime);
    const appointmentDateTimeInput =
      sanitizeString(payload.appointmentDateTime) ||
      sanitizeString(payload.AppointmentDateTime);
    const firstName = sanitizeString(payload.firstName);
    const lastName = sanitizeString(payload.lastName);
    const birthDate = sanitizeString(payload.birthDate);
    const email = null;
    const digitsOnly = value => (typeof value === 'string' ? value.replace(/\D+/g, '') : '');
    const phoneRaw = sanitizeString(payload.phone);
    const phone = digitsOnly(phoneRaw) || phoneRaw;
    const comments = sanitizeString(payload.comments) || 'Initial Consult LABORFORCE';

    if ((!appointmentDate || !appointmentTime) && appointmentDateTimeInput) {
      const { date: extractedDate, time: extractedTime } =
        extractDateTimeParts(appointmentDateTimeInput);
      if (!appointmentDate && extractedDate) {
        appointmentDate = extractedDate;
      }
      if (!appointmentTime && extractedTime) {
        appointmentTime = extractedTime;
      }
    }

    const appointmentDateForRequest = formatWidgetDate(appointmentDate);
    const appointmentTimeForRequest = formatWidgetTime(appointmentTime);

    if (!providerKey || !locationKey || !appointmentDateForRequest || !appointmentTimeForRequest) {
      throw new Error('Missing scheduling details required for appointment confirmation.');
    }

    const appointmentDateTimeForRequest = formatAppointmentDateTime(
      appointmentDateForRequest,
      appointmentTimeForRequest
    );

    console.log('[ConfirmAppointment] secondary book date debug', {
      originalDate: sanitizeString(payload.appointmentDate),
      originalTime: sanitizeString(payload.appointmentTime),
      formattedDate: appointmentDateForRequest,
      formattedTime: appointmentTimeForRequest,
      appointmentDateTimeForRequest,
    });

    const notificationPreference = 'Cell';

    const baseWidgetBody = {
      practiceKey: '1',
      providerKey,
      locationKey,
      visitTypeKey: '355',
      appointmentDate: appointmentDateForRequest,
      appointmentTime: appointmentTimeForRequest,
      firstName,
      lastName,
      birthDate,
      email,
      phone,
      comments,
      notificationPreference,
    };

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const url = `${WIDGET_API_URL}/appointment/book-appointment`;
    console.log('[ConfirmAppointment] secondary book request', {
      url,
      data: {
        ...baseWidgetBody,
        phone: baseWidgetBody.phone ? `***${baseWidgetBody.phone.slice(-4)}` : '',
      },
      headers,
      timeout: apiClient.defaults.timeout,
    });

    try {
      const response = await axios.post(url, baseWidgetBody, {
        headers,
        timeout: apiClient.defaults.timeout,
      });

      console.log('[ConfirmAppointment] secondary book response', {
        status: response?.status,
        success: response?.data?.success,
      });

      if (response?.data?.success === false) {
        const message =
          response?.data?.message ||
          response?.data?.Message ||
          'Booking failed in external system.';
        throw new Error(message);
      }
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const message =
        data?.message ||
        data?.Message ||
        data?.error ||
        data?.Error ||
        data?.errorMessage ||
        error?.message ||
        'Unable to sync appointment with widget service.';

      console.warn('[ConfirmAppointment] secondary book error', {
        status,
        data,
        message,
      });

      if (status && status >= 400 && status < 500) {
        throw new Error(message);
      }

      if (typeof error?.message === 'string' && /network/i.test(error.message)) {
        return { success: false, skipped: true, message };
      }

      return { success: false, skipped: true, status, message };
    }
  };

  const token = await AsyncStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    AppSecret: APP_SECRET,
    ...(token ? { Token: token } : {}),
  };

  const logHeaders = { ...headers };
  if (logHeaders.Token) logHeaders.Token = '[redacted]';
  if (logHeaders.AppSecret) logHeaders.AppSecret = '[redacted]';

  const attemptBooking = async locationValue => {
    if (!locationValue) {
      throw new Error('Location key is required to book this appointment.');
    }

    const params = {
      AppointmentDateTime: String(AppointmentDateTime),
      ProviderKey: String(ProviderKey),
      LocationKey: locationValue,
      PatientKey: String(PatientKey),
      VisitTypeKey: VisitTypeKey != null ? String(VisitTypeKey) : undefined,
      VisitDuration: VisitDuration != null ? String(VisitDuration) : undefined,
    };

    const body = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value != null && value !== '')
    ).toString();

    console.log('[ConfirmAppointment] book request', {
      url: `${BASE_API_URL}/appointment/book`,
      data: { ...params },
      headers: logHeaders,
      timeout: apiClient.defaults.timeout,
    });

    const response = await apiClient.post('/appointment/book', body, { headers });
    const { data } = response;
    const scheduleKey =
      data?.result?.ScheduleKey ??
      data?.result?.scheduleKey ??
      data?.result?.Schedulekey ??
      data?.result;

    console.log('[ConfirmAppointment] book response', {
      status: response?.status,
      success: data?.success,
      scheduleKey,
    });

    if (!data.success) {
      throw new Error(data.message || 'Booking failed');
    }
    return data.result;
  };

  const firstKey = preferredLocationKey || fallbackLocationKey;
  let bookingResult;
  try {
    bookingResult = await attemptBooking(firstKey);
  } catch (err) {
    const message = (err && err.message ? String(err.message) : '').toLowerCase();
    const shouldRetry =
      fallbackLocationKey &&
      fallbackLocationKey !== firstKey &&
      message.includes('invalid location');

    if (shouldRetry) {
      console.warn('[ConfirmAppointment] retrying booking with primary location key');
      bookingResult = await attemptBooking(fallbackLocationKey);
    } else {
      throw err;
    }
  }

  await postSecondaryBooking(secondaryBooking);

  return bookingResult;
}

// 11) Get patient details for the logged in user
export async function getPatient(patientKey) {
  if (!patientKey) throw new Error('patientKey is required');
  const { data } = await apiClient.get('/patient/id', {
    params: { patientkey: patientKey }
  });
  if (!data.success) throw new Error(data.message || 'Failed to fetch patient');
  return data.result;
}

// 12) Fetch the current user’s details
export async function getUserProfile() {
  const userId = await AsyncStorage.getItem('authUserId');
  if (!userId) throw new Error('No userId in storage');
  const { data } = await apiClient.get(
    '/externalservice/cm/user/get',
    { params: { UserId: userId } }
  );
  if (!data.success) throw new Error(data.message || 'Failed to load user profile');
  return data.result;
}

// 13) Update the current user’s details
export async function updateUserProfile({ firstName, lastName, phone, email, password, userId }) {
  // userId is required by the API; include email or phone (or both) per spec
  const payload = {
    UserId:    userId,
    FirstName: firstName,
    LastName:  lastName,
    PhoneNo:   phone,     // named exactly as the API expects
    Email:     email,     // optional
    Password:  password,  // optional
  };

  const body = new URLSearchParams(
    Object.entries(payload).filter(([, v]) => v != null)
  ).toString();

  const { data } = await apiClient.post(
    '/user/update',
    body
  );

  if (!data.success) {
    throw new Error(data.message || 'Update user failed');
  }
  return data.result;
}

// 14) Fetch the current patient’s profile by patientKey
export async function getPatientProfile(patientKey) {
  if (!patientKey) throw new Error('patientKey is required');
  const { data } = await apiClient.get(
    '/patient/id',
    { params: { patientkey: patientKey } }
  );
  if (!data.success) throw new Error(data.message || 'Failed to fetch patient');
  return data.result;
}

// 15) Add a new referral for a patient
export async function addReferral({ patientKey, referrer, comments = '' }) {
  // referrer should be an object like { Id, Name, Type }
  // CHANGE 2: Accept optional comments parameter for location information
  const payload = {
    PatientKey:        patientKey,
    ReferredBy:        referrer,
    ReferralDate:      new Date().toISOString().split('T')[0] + 'T00:00:00', // YYYY-MM-DDT00:00:00
    EncounterKey:      0,
    ReferralType:      'In',
    NextScheduledDate: '',  // Blank as per specification
    Comments:          comments,
  };

  console.log('═══════════════════════════════════════');
  console.log('📋 REFERRALS/ADD API REQUEST');
  console.log('═══════════════════════════════════════');
  console.log('Endpoint: POST', BASE_API_URL + '/referrals/add');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('═══════════════════════════════════════');

  const { data } = await apiClient.post('/referrals/add', payload);

  console.log('═══════════════════════════════════════');
  console.log('📋 REFERRALS/ADD API RESPONSE');
  console.log('═══════════════════════════════════════');
  console.log('Response:', JSON.stringify(data, null, 2));
  console.log('═══════════════════════════════════════');

  if (!data.success) throw new Error(data.message || 'Failed to add referral');
  return data;
}

export async function getAppointments({ patientKey }) {
  const { data } = await apiClient.get('/appointment/list', {
    params: { patientKey }
  });
  if (!data.success) throw new Error(data.message||'Failed to fetch appointments');
  return data.result;  // array of appts
}

// Change the current user's password
export async function changePassword({ oldPassword, newPassword }) {
  const userId = await AsyncStorage.getItem('authUserId');
  if (!userId) throw new Error('No userId in storage');
  const payload = {
    UserId: userId,
    OldPassword: oldPassword,
    Password: newPassword,
  };
  const { data } = await apiClient.post('/user/changepassword', encode(payload));
  if (!data.success) throw new Error(data.message || 'Password change failed');
  return data;
}

// Request a password reset OTP – no auth token required
export async function requestPasswordReset({ UserId }) {
  const body = new URLSearchParams({ UserId }).toString();
  const res = await fetch(`${BASE_API_URL}/user/resetpassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      AppSecret: APP_SECRET,
    },
    body,
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* non-JSON */ }

  if (!res.ok || data.success === false) {
    const msg = data.message || text || 'Password reset failed';
    throw new Error(msg);
  }
  return data;
}

// Set a new password using the OTP – clear any existing auth token
export async function setPasswordWithOTP({ UserId, LoginOTP, Password }) {
  const body = new URLSearchParams({ UserId, LoginOTP, Password }).toString();
  const res = await fetch(`${BASE_API_URL}/user/setpassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      AppSecret: APP_SECRET,
    },
    body,
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* non-JSON */ }

  if (!res.ok || data.success === false) {
    const msg = data.message || text || 'Set password failed';
    throw new Error(msg);
  }

  // remove any cached auth tokens so future requests don't send an invalid one
  try { await AsyncStorage.removeItem('authToken'); } catch (e) { /* ignore */ }
  try { await AsyncStorage.removeItem('authUserId'); } catch (e) { /* ignore */ }
  try { await SecureStore.deleteItemAsync('sessionToken'); } catch (e) { /* ignore */ }
  setAuthToken(null);

  return data;
}
