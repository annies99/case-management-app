import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET, WIDGET_API_URL } from '../config/constants';

const apiClient = axios.create({
  baseURL: BASE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    AppSecret: APP_SECRET,
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Token = token;
  }
  return config;
});

const formatReferralDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoString = value => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const buildLocationComments = ({
  locationName,
  address1,
  address2,
  city,
  state,
  zip,
}) => {
  const street = [address1, address2].filter(Boolean).join(' ').trim();
  const cityStateZip = [city, state, zip].filter(Boolean).join(' ').trim();
  const address = [street, cityStateZip].filter(Boolean).join(', ');
  return address ? `${locationName} - ${address}` : locationName;
};

/**
 * Convert YYYYMMDDHHMMAM/PM format to MM/DD/YYYY and H:MM AM/PM
 */
const parseAppointmentDateTime = (dateTimeString) => {
  if (!dateTimeString || typeof dateTimeString !== 'string') {
    return { date: '', time: '' };
  }

  const match = dateTimeString.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(AM|PM)$/i);
  if (!match) {
    return { date: '', time: '' };
  }

  const [, year, month, day, hour, minute, meridiem] = match;
  const formattedDate = `${month}/${day}/${year}`;
  const formattedTime = `${parseInt(hour, 10)}:${minute} ${meridiem.toUpperCase()}`;

  return { date: formattedDate, time: formattedTime };
};

/**
 * Format date object or ISO string to MM/DD/YYYY
 */
const formatDateToSlash = (dateValue) => {
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  } else {
    return '';
  }

  if (isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Book appointment on IPM/EZDocs system (widget.ahccenters.com)
 * @param {Object} params
 * @param {string} params.providerExternalKey - External IPM provider key
 * @param {string} params.locationExternalKey - External IPM location key
 * @param {string|Date} params.startDateTime - ISO string or Date object
 * @param {string} params.appointmentDateTime - YYYYMMDDHHMMAM/PM format (fallback)
 * @param {string} params.appointmentTime - H:MM AM/PM format (fallback)
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.birthDate - MM/DD/YYYY format
 * @param {string} params.phone - Digits only
 */
export async function bookIPMAppointment({
  providerExternalKey,
  locationExternalKey,
  startDateTime,
  appointmentDateTime,
  appointmentTime,
  firstName,
  lastName,
  birthDate,
  phone,
}) {
  // Extract date and time - prioritize explicit params over ISO datetime
  let appointmentDate = '';
  let appointmentTimeFormatted = '';

  // First, try to use appointmentDateTime format (YYYYMMDDHHMMAM/PM) if provided
  if (appointmentDateTime) {
    const parsed = parseAppointmentDateTime(appointmentDateTime);
    appointmentDate = parsed.date;
    appointmentTimeFormatted = parsed.time;
  }

  // If we still don't have time, use appointmentTime parameter
  if (!appointmentTimeFormatted && appointmentTime) {
    appointmentTimeFormatted = appointmentTime;
  }

  // Final fallback to startDateTime (but this might have timezone issues)
  if (!appointmentDate || !appointmentTimeFormatted) {
    if (startDateTime) {
      if (!appointmentDate) {
        appointmentDate = formatDateToSlash(startDateTime);
      }
      if (!appointmentTimeFormatted) {
        const date = startDateTime instanceof Date ? startDateTime : new Date(startDateTime);
        if (!isNaN(date.getTime())) {
          const hours = date.getHours();
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const meridiem = hours >= 12 ? 'PM' : 'AM';
          const hour12 = hours % 12 || 12;
          appointmentTimeFormatted = `${hour12}:${minutes} ${meridiem}`;
        }
      }
    }
  }

  if (!providerExternalKey || !locationExternalKey) {
    throw new Error('Missing external IPM keys for provider or location.');
  }

  if (!appointmentDate || !appointmentTimeFormatted) {
    throw new Error('Missing appointment date or time for IPM booking.');
  }

  const payload = {
    practiceKey: '1',
    providerKey: String(providerExternalKey),
    locationKey: String(locationExternalKey),
    visitTypeKey: '355',
    appointmentDate,
    appointmentTime: appointmentTimeFormatted,
    firstName: firstName || 'Patient',
    lastName: lastName || 'Guest',
    birthDate: birthDate || '01/01/2000',
    email: null,
    phone: phone || '',
    comments: 'Initial Consult LABORFORCE',
    notificationPreference: 'Cell',
  };

  console.log('[IPM Booking] Request:', {
    url: `${WIDGET_API_URL}/appointment/book-appointment`,
    payload,
    debug: {
      rawAppointmentDateTime: appointmentDateTime,
      rawAppointmentTime: appointmentTime,
      rawStartDateTime: startDateTime,
      finalDate: appointmentDate,
      finalTime: appointmentTimeFormatted,
    },
  });

  try {
    const response = await axios.post(
      `${WIDGET_API_URL}/appointment/book-appointment`,
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('[IPM Booking] Response:', {
      status: response?.status,
      success: response?.data?.success,
    });

    if (response?.data?.success === false) {
      const message = response?.data?.message || response?.data?.Message || 'IPM booking failed.';
      throw new Error(message);
    }

    return response.data;
  } catch (error) {
    console.error('[IPM Booking] Error:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });
    throw error;
  }
}

/**
 * @typedef {Object} ReferralPayload
 * @property {string|number} PatientKey
 * @property {{ Id: string|number, Name: string, Type: 'Provider' }} ReferredBy
 * @property {string} ReferralDate
 * @property {0} EncounterKey
 * @property {'In'} ReferralType
 * @property {null} NextScheduledDate
 * @property {string} Comments
 */

/**
 * @typedef {Object} SchedulePayload
 * @property {string|number} ReferralKey
 * @property {string|number} PatientKey
 * @property {string} StartDateTime
 * @property {string} EndDateTime
 * @property {'Open'} Status
 * @property {string} [Comments]
 */

/**
 * @param {Object} params
 * @param {string|number} params.patientKey
 * @param {string|number} params.internalProviderKey
 * @param {string} params.providerName
 * @param {string} params.locationName
 * @param {string} [params.address1]
 * @param {string} [params.address2]
 * @param {string} [params.city]
 * @param {string} [params.state]
 * @param {string} [params.zip]
 * @param {string|Date} params.startDateTime
 * @param {string|Date} params.endDateTime
 * @param {string} [params.notes]
 * @param {string} [params.providerExternalKey] - External IPM provider key
 * @param {string} [params.locationExternalKey] - External IPM location key
 * @param {string} [params.appointmentDateTime] - YYYYMMDDHHMMAM/PM format
 * @param {string} [params.appointmentTime] - H:MM AM/PM format
 * @param {string} [params.firstName] - Patient first name
 * @param {string} [params.lastName] - Patient last name
 * @param {string} [params.birthDate] - Patient birthdate MM/DD/YYYY
 * @param {string} [params.phone] - Patient phone
 */
export async function bookAppointmentTransaction({
  patientKey,
  internalProviderKey,
  providerName,
  locationName,
  address1,
  address2,
  city,
  state,
  zip,
  startDateTime,
  endDateTime,
  notes,
  providerExternalKey,
  locationExternalKey,
  appointmentDateTime,
  appointmentTime,
  firstName,
  lastName,
  birthDate,
  phone,
}) {
  /** @type {ReferralPayload} */
  const referralPayload = {
    PatientKey: patientKey,
    ReferredBy: {
      Id: internalProviderKey,
      Name: providerName,
      Type: 'Provider',
    },
    ReferralDate: formatReferralDate(),
    EncounterKey: 0,
    ReferralType: 'In',
    NextScheduledDate: null,
    Comments: buildLocationComments({
      locationName,
      address1,
      address2,
      city,
      state,
      zip,
    }),
  };

  const { data: referralResponse } = await apiClient.post('/referrals/add', referralPayload);
  if (!referralResponse?.success) {
    throw new Error(referralResponse?.message || 'Failed to create referral.');
  }

  const referralKey =
    referralResponse?.result?.ReferralKey ??
    referralResponse?.result?.ReferalKey ??
    referralResponse?.ReferralKey ??
    referralResponse?.ReferalKey ??
    referralResponse?.referralKey ??
    referralResponse?.result?.referralKey;

  if (!referralKey) {
    throw new Error('Referral created but no ReferralKey returned.');
  }

  /** @type {SchedulePayload} */
  const schedulePayload = {
    ReferralKey: referralKey,
    PatientKey: patientKey,
    StartDateTime: toIsoString(startDateTime),
    EndDateTime: toIsoString(endDateTime),
    Status: 'Open',
    Comments: notes || '',
  };

  try {
    const { data: scheduleResponse } = await apiClient.post('/referralschedules/add', schedulePayload);
    if (!scheduleResponse?.success) {
      throw new Error(scheduleResponse?.message || 'Failed to create referral schedule.');
    }
  } catch (error) {
    throw new Error('Referral Created but Slot Booking Failed');
  }

  // Book on IPM/EZDocs if external keys are provided
  if (providerExternalKey && locationExternalKey) {
    try {
      await bookIPMAppointment({
        providerExternalKey,
        locationExternalKey,
        startDateTime,
        appointmentDateTime,
        appointmentTime,
        firstName,
        lastName,
        birthDate,
        phone,
      });
      console.log('[Booking] IPM booking successful');
    } catch (ipmError) {
      // Log but don't fail the entire transaction if IPM booking fails
      console.error('[Booking] IPM booking failed:', ipmError?.message);
      // Optionally, you could throw here if you want IPM booking to be required
      // throw new Error('Primary booking succeeded but IPM booking failed: ' + ipmError?.message);
    }
  } else {
    console.warn('[Booking] Skipping IPM booking - missing external keys');
  }

  return { referralKey };
}
