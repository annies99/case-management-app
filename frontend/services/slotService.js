// frontend/services/slotService.js

import axios from 'axios';
import { SLOT_API_URL, APP_SECRET } from '../config/constants';

const GET_AVAILABLE_SLOTS_PATH = '/appointment/getavailableslots';

const normalizeParam = value => {
  if (value == null) return '';
  const str = String(value).trim();
  return str;
};

const formatDateParam = date => {
  if (!(date instanceof Date)) {
    throw new Error('A valid date is required to load available time slots.');
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}${month}${day}`;
};

export async function fetchAvailableSlots({
  locationKey,
  providerKey,
  fromDate,
  toDate,
  slotSize = 15,
  slotDuration = 60,
}) {
  // providerKey must be the external provider identifier (from the referring providers API).
  const normalizedLocationKey = normalizeParam(locationKey);
  const normalizedProviderKey = normalizeParam(providerKey);

  if (!normalizedLocationKey || !normalizedProviderKey) {
    throw new Error('Location and provider are required to load time slots.');
  }

  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
    throw new Error('A valid date range is required to load time slots.');
  }

  if (fromDate > toDate) {
    throw new Error('The start date must be on or before the end date.');
  }

  const normalizedFrom = formatDateParam(fromDate);
  const normalizedTo = formatDateParam(toDate);
  const params = {
    locationKey: normalizedLocationKey,
    providerKey: normalizedProviderKey,
    fromDate: normalizedFrom,
    toDate: normalizedTo,
    slotSize: String(slotSize),
    slotDuration: String(slotDuration),
    practiceKey: '1',
  };
  console.log('[slots] GET /appointment/getavailableslots', { params });

  let response;
  try {
    response = await axios.get(`${SLOT_API_URL}${GET_AVAILABLE_SLOTS_PATH}`, {
      headers: {
        Accept: 'application/json',
        AppSecret: APP_SECRET,
      },
      params,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new Error('Unable to reach the appointment service. Please try again.');
  }

  const { status, data } = response;

  if (status >= 200 && status < 300 && (data?.success ?? true)) {
    if (Array.isArray(data?.result)) {
      return data.result;
    }

    if (Array.isArray(data?.slots)) {
      return data.slots;
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }

  const message = data?.message || `Failed to load time slots (HTTP ${status})`;
  throw new Error(message);
}

export default fetchAvailableSlots;
