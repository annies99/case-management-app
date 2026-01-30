// frontend/screens/InitialConsultationScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  View,
  Alert,
  Platform,
  FlatList,
  Modal,
  TouchableWithoutFeedback,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { FIRST_AVAILABLE_SLOTS_API_URL, APP_SECRET } from '../config/constants';
import { getPatientProfile } from '../services/authService';
import {
  geocodeAddress,
  distanceKm,
  distanceMiles,
  getDrivingDistancesMiles,
} from '../services/geoService';
import { fetchPracticeLocations, getExternalKey } from '../services/locationService';
import { fetchProvidersForLocation } from '../services/providerService';
import SimpleDatePickerModal from '../components/SimpleDatePickerModal';

const sanitize = value => (typeof value === 'string' ? value.trim() : '');

const toKeyString = value => {
  if (value == null) return '';
  return String(value).trim();
};

const resolveInternalProviderKey = provider => {
  const candidates = [
    provider?.InternalProviderKey,
    provider?.ProviderKey,
    provider?.providerKey,
    provider?.ProviderID,
    provider?.ProviderId,
    provider?.providerID,
    provider?.providerId,
    provider?.Id,
    provider?.id,
    provider?.Key,
    provider?.key,
    provider?.PrimaryKey,
    provider?.primaryKey,
  ];

  for (const candidate of candidates) {
    const normalized = toKeyString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const resolveExternalProviderId = provider => {
  const candidates = [
    provider?.ExternalID,
    provider?.ExternalId,
    provider?.externalId,
    provider?.ExternalProviderKey,
    provider?.externalProviderKey,
    provider?.ProviderExternalKey,
    provider?.providerExternalKey,
    provider?.ExternalKey,
    provider?.externalKey,
    provider?.ExternalIPMKey,
    provider?.externalIPMKey,
    provider?.externalIpmKey,
    provider?.ExternalIpmKey,
  ];

  for (const candidate of candidates) {
    const normalized = toKeyString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const resolveProviderLocationKey = provider => {
  const candidates = [
    provider?.LocationKey,
    provider?.locationKey,
    provider?.LocationID,
    provider?.LocationId,
    provider?.locationID,
    provider?.locationId,
    provider?.PracticeLocationKey,
    provider?.practiceLocationKey,
  ];

  for (const candidate of candidates) {
    const normalized = toKeyString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const normalizeToDate = value => {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return new Date(value);
    }
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value === 'string' && value.trim()) {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }

  return null;
};

const startOfDay = date => {
  const normalized = normalizeToDate(date);
  if (!normalized) return null;
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const endOfDay = date => {
  const normalized = normalizeToDate(date);
  if (!normalized) return null;
  normalized.setHours(23, 59, 59, 0);
  return normalized;
};

// Unified helpers so both label variants are available where referenced
const formatMonthDayLabel = date => {
  const normalized = normalizeToDate(date);
  if (!normalized) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(normalized);
  } catch (err) {
    try {
      return normalized.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return `${normalized.getMonth() + 1}/${normalized.getDate()}`;
    }
  }
};

const formatDateDisplay = date => {
  const normalized = normalizeToDate(date);
  if (!normalized) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(normalized);
  } catch {
    return normalized.toDateString();
  }
};

const formatDateRangeDisplay = (startDate, endDate) => {
  const normalizedStart = normalizeToDate(startDate);
  const normalizedEnd = normalizeToDate(endDate);
  const hasStart = normalizedStart instanceof Date;
  const hasEnd = normalizedEnd instanceof Date;

  if (hasStart && hasEnd) {
    const startLabel = formatMonthDayLabel(normalizedStart);
    const endLabel = formatMonthDayLabel(normalizedEnd);
    if (startLabel && startLabel === endLabel) {
      return startLabel;
    }
    if (startLabel && endLabel) {
      return `${startLabel} - ${endLabel}`;
    }
    return startLabel || endLabel || '';
  }

  if (hasStart) {
    return formatMonthDayLabel(normalizedStart);
  }

  if (hasEnd) {
    return formatMonthDayLabel(normalizedEnd);
  }

  return '';
};

const initialToday = (() => {
  const normalized = startOfDay(new Date());
  if (normalized) return normalized;
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
})();

const formatAddress = location =>
  [location.address1, location.address2, location.city, location.state, location.zip]
    .map(part => sanitize(part))
    .filter(Boolean)
    .join('\n');

const normalizePostalCode = value => {
  const raw = sanitize(value);
  if (!raw) return '';

  const digits = raw.match(/\d+/g)?.join('') || '';
  if (!digits) return '';

  if (digits.length <= 5) {
    return digits.padStart(5, '0');
  }

  if (digits.length >= 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  }

  return digits.slice(0, 5);
};

const buildFullAddress = location =>
  [location.address1, location.address2, location.city, location.state, normalizePostalCode(location.zip)]
    .map(part => sanitize(part))
    .filter(Boolean)
    .join(', ');

const createAddressVariants = location => {
  const normalizedZip = normalizePostalCode(location.zip);
  return [
    [location.address1, location.address2, location.city, location.state, normalizedZip],
    [location.address1, location.city, location.state, normalizedZip],
    [location.address1, location.city, location.state],
    [location.city, location.state],
  ];
};

const authHeaders = async () => {
  const token = (await AsyncStorage.getItem('authToken'))?.trim();
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json', AppSecret: APP_SECRET };
  if (token) headers.Token = token;
  return { headers, timeout: 30000 };
};

const formatTimeFromDate = value => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }
  try {
    return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (err) {
    const hours = `${value.getHours()}`.padStart(2, '0');
    const minutes = `${value.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }
};

const parseAppointmentDateTime = value => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{12}(AM|PM)$/i.test(trimmed)) {
    return null;
  }

  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(4, 6));
  const day = Number(trimmed.slice(6, 8));
  let hour = Number(trimmed.slice(8, 10));
  const minute = Number(trimmed.slice(10, 12));
  const meridiem = trimmed.slice(12).toUpperCase();

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (meridiem === 'PM' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'AM' && hour === 12) {
    hour = 0;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const toISO = d => {
  const normalized = normalizeToDate(d);
  if (!normalized) {
    return new Date().toISOString().slice(0, 19);
  }
  return normalized.toISOString().slice(0, 19);
}; // yyyy-mm-ddTHH:mm:ss

const toYyyyMmDd = d => {
  const normalized = normalizeToDate(d);
  const safeDate = normalized instanceof Date ? normalized : new Date();
  const year = safeDate.getFullYear();
  const month = `${safeDate.getMonth() + 1}`.padStart(2, '0');
  const day = `${safeDate.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

const pickFirst = (...candidates) => {
  for (const value of candidates) {
    if (value == null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    return value;
  }
  return undefined;
};

const extractDateToken = value => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  const slashMatch = trimmed.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  if (slashMatch) {
    return slashMatch[0];
  }

  const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return isoMatch[0];
  }

  return '';
};

const resolveDisplayDate = value => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return formatDateDisplay(value);
  }

  if (typeof value === 'string') {
    const compact = value.trim();
    if (!compact) {
      return '';
    }

    if (/^\d{8}$/.test(compact)) {
      const normalized = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
      const parsedCompact = normalizeToDate(normalized);
      if (parsedCompact instanceof Date) {
        return formatDateDisplay(parsedCompact);
      }
      return normalized;
    }

    const parsedFromString = normalizeToDate(compact);
    if (parsedFromString instanceof Date) {
      return formatDateDisplay(parsedFromString);
    }

    return compact;
  }

  const parsed = normalizeToDate(value);
  if (parsed instanceof Date) {
    return formatDateDisplay(parsed);
  }

  return '';
};

const resolveDisplayTime = (value, fallback) => {
  const extract = candidate => {
    if (!candidate) {
      return '';
    }

    if (candidate instanceof Date) {
      try {
        return candidate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } catch {
        return candidate.toISOString().slice(11, 16);
      }
    }

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return '';
      }

      const meridiemMatch = trimmed.match(/\d{1,2}:\d{2}(?::\d{2})?\s?[AP]M/i);
      if (meridiemMatch) {
        return meridiemMatch[0].replace(/\s+/g, ' ').toUpperCase();
      }

      const timeMatch = trimmed.match(/\d{1,2}:\d{2}(?::\d{2})?/);
      if (timeMatch) {
        return timeMatch[0];
      }

      return trimmed;
    }

    return '';
  };

  return extract(value) || extract(fallback);
};

const pad2 = value => String(value).padStart(2, '0');

const parseDateComponent = value => {
  const coerceFromDate = date => ({
    year: String(date.getFullYear()),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
  });

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return coerceFromDate(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    if (!Number.isNaN(fromNumber.getTime())) {
      return coerceFromDate(fromNumber);
    }
  }

  if (!value) {
    return null;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  if (/^\d{8}$/.test(str)) {
    return {
      year: str.slice(0, 4),
      month: str.slice(4, 6),
      day: str.slice(6, 8),
    };
  }

  let match = str.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return { year, month: pad2(month), day: pad2(day) };
  }

  match = str.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return { year, month: pad2(month), day: pad2(day) };
  }

  match = str.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return { year, month, day };
  }

  const parsed = normalizeToDate(str);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
    return coerceFromDate(parsed);
  }

  return null;
};

const parseTimeComponent = value => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return { hour: pad2(hour12), minute: pad2(minutes), meridiem };
  }

  if (!value) {
    return null;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  let match = str.match(/^(\d{1,2})(\d{2})([AP]M)$/i);
  if (match) {
    let [, hour, minute, meridiem] = match;
    let numericHour = Number(hour);
    if (!Number.isFinite(numericHour) || numericHour < 1 || numericHour > 12) {
      return null;
    }
    meridiem = meridiem.toUpperCase();
    return { hour: pad2(numericHour), minute: pad2(minute || '00'), meridiem };
  }

  match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)/i);
  if (match) {
    let [, hour, minute, , meridiem] = match;
    let numericHour = Number(hour);
    if (!Number.isFinite(numericHour) || numericHour < 1 || numericHour > 12) {
      return null;
    }
    meridiem = meridiem.toUpperCase();
    return { hour: pad2(numericHour), minute: pad2(minute), meridiem };
  }

  match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    let [, hour, minute] = match;
    let numericHour = Number(hour);
    if (!Number.isFinite(numericHour)) {
      return null;
    }
    const meridiem = numericHour >= 12 ? 'PM' : 'AM';
    numericHour = numericHour % 12 || 12;
    return { hour: pad2(numericHour), minute: pad2(minute), meridiem };
  }

  return null;
};

const buildAppointmentDateTime = (dateValue, timeValue, fallback) => {
  const dateParts = parseDateComponent(dateValue) || parseDateComponent(fallback);
  const timeParts = parseTimeComponent(timeValue) || parseTimeComponent(fallback);

  if (!dateParts || !timeParts) {
    return '';
  }

  return `${dateParts.year}${dateParts.month}${dateParts.day}${timeParts.hour}${timeParts.minute}${timeParts.meridiem}`;
};

const extractSlotsArray = payload => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const nestedKeys = ['slots', 'Slots', 'result', 'Result', 'data', 'Data'];
    for (const key of nestedKeys) {
      if (key in payload) {
        const nested = payload[key];
        const result = extractSlotsArray(nested);
        if (result.length) {
          return result;
        }
        if (Array.isArray(nested)) {
          return nested;
        }
      }
    }
  }

  return [];
};

const parseSlotRange = value => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('-');
  if (separatorIndex === -1) {
    return { start: trimmed, end: null };
  }

  const start = trimmed.slice(0, separatorIndex).trim();
  const end = trimmed.slice(separatorIndex + 1).trim();

  if (!start) {
    return null;
  }

  return { start, end: end || null };
};

const normalizeSlotResults = raw => {
  let counter = 0;
  const normalized = [];
  const seen = new Set();

  const pushSlot = ({
    providerName,
    appointmentDate,
    startLabel,
    timeLabel,
    idCandidate,
  }) => {
    const safeTime = typeof timeLabel === 'string' ? timeLabel.trim() : '';
    if (!safeTime) {
      return;
    }

    const rawDate = appointmentDate || extractDateToken(startLabel);
    const signatureDate = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : typeof rawDate === 'string'
      ? rawDate.trim()
      : '';
    const signature = `${signatureDate}__${safeTime}__${providerName || ''}`;
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);

    const displayDate = resolveDisplayDate(rawDate);
    const id = idCandidate ? String(idCandidate) : `slot-${++counter}`;
    const start = startLabel || (displayDate ? `${displayDate} ${safeTime}`.trim() : safeTime);
    const bookingDateTime = buildAppointmentDateTime(rawDate, safeTime, startLabel);

    normalized.push({
      id,
      start,
      providerName: providerName || null,
      dateLabel: displayDate,
      timeLabel: safeTime,
      bookingDateTime,
    });
  };

  const visit = (node, context = {}) => {
    if (node == null) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(item => visit(item, context));
      return;
    }

    if (typeof node === 'string') {
      const parsed = parseSlotRange(node);
      if (parsed && parsed.start && !parsed.end) {
        const { appointmentDate, providerName } = context;
        const startLabel = appointmentDate ? `${appointmentDate} ${parsed.start}`.trim() : parsed.start;
        pushSlot({
          providerName,
          appointmentDate,
          startLabel,
          timeLabel: parsed.start,
        });
      }
      return;
    }

    if (typeof node !== 'object') {
      return;
    }

    const providerName =
      pickFirst(
        node?.providerName,
        node?.ProviderName,
        node?.providerFullName,
        node?.ProviderFullName,
        context.providerName,
      ) || null;

    const appointmentDateRaw =
      pickFirst(node?.AppointmentDate, node?.appointmentDate, context.appointmentDate) || null;

    const startLabel = buildDateTimeLabel(node, 'start');
    const timeCandidate = pickFirst(
      node?.AppointmentTime,
      node?.appointmentTime,
      node?.Time,
      node?.time,
      node?.startTime,
      node?.StartTime,
      node?.slotStartTime,
      node?.SlotStartTime,
      startLabel,
    );
    const timeLabel = resolveDisplayTime(timeCandidate, startLabel);

    const idCandidate = pickFirst(
      node?.slotId,
      node?.SlotId,
      node?.slotID,
      node?.SlotID,
      node?.id,
      node?.Id,
      node?.slotKey,
      node?.SlotKey,
    );

    const rawDate = appointmentDateRaw || extractDateToken(startLabel);
    const combinedStart = startLabel || (rawDate ? `${rawDate} ${timeLabel}`.trim() : timeLabel);

    pushSlot({
      providerName,
      appointmentDate: rawDate,
      startLabel: combinedStart,
      timeLabel,
      idCandidate,
    });

    const nestedKeys = [
      'AppointmentTime',
      'appointmentTime',
      'AppointmentTimes',
      'appointmentTimes',
      'AppointmentSlots',
      'appointmentSlots',
      'AppointmentSlot',
      'appointmentSlot',
      'slots',
      'Slots',
      'times',
      'Times',
    ];

    nestedKeys.forEach(key => {
      if (key in node) {
        const nestedValue = node[key];
        if (nestedValue != null && nestedValue !== node) {
          visit(nestedValue, { providerName, appointmentDate: rawDate });
        }
      }
    });
  };

  visit(raw, {});

  return normalized.filter(slot => typeof slot.timeLabel === 'string' && slot.timeLabel.trim());
};

const buildDateTimeLabel = (slot, type) => {
  const directValue = pickFirst(
    slot?.[type],
    slot?.[type === 'start' ? 'startTime' : 'endTime'],
    slot?.[type === 'start' ? 'StartTime' : 'EndTime'],
    slot?.[type === 'start' ? 'startDate' : 'endDate'],
    slot?.[type === 'start' ? 'StartDate' : 'EndDate'],
    slot?.[type === 'start' ? 'startDateTime' : 'endDateTime'],
    slot?.[type === 'start' ? 'StartDateTime' : 'EndDateTime'],
    slot?.[type === 'start' ? 'slotStart' : 'slotEnd'],
    slot?.[type === 'start' ? 'SlotStart' : 'SlotEnd'],
    slot?.[type === 'start' ? 'slotStartTime' : 'slotEndTime'],
    slot?.[type === 'start' ? 'SlotStartTime' : 'SlotEndTime'],
    slot?.[type === 'start' ? 'slotStartDateTime' : 'slotEndDateTime'],
    slot?.[type === 'start' ? 'SlotStartDateTime' : 'SlotEndDateTime'],
  );

  if (directValue) {
    return directValue;
  }

  const date = pickFirst(slot?.slotDate, slot?.SlotDate, slot?.date, slot?.Date);
  const time = pickFirst(
    slot?.[type === 'start' ? 'startTime' : 'endTime'],
    slot?.[type === 'start' ? 'StartTime' : 'EndTime'],
    slot?.[type === 'start' ? 'slotStartTime' : 'slotEndTime'],
    slot?.[type === 'start' ? 'SlotStartTime' : 'SlotEndTime'],
  );

  if (date && time) {
    return `${date} ${time}`;
  }

  return undefined;
};

export default function InitialConsultationScreen({ navigation, route }) {
  const { t } = useTranslation();
  const patientKey = route?.params?.patientKey;
  const visitTypeKey = route?.params?.visitTypeKey ?? 1; // override via route when decided
  const patientLat = route?.params?.lat;
  const patientLng = route?.params?.lng;

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [err, setErr] = useState('');
  const [allLocations, setAllLocations] = useState([]);
  const [top3, setTop3] = useState([]);
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [patientAddress, setPatientAddress] = useState('');
  const [patientName, setPatientName] = useState('');
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [providers, setProviders] = useState([]);
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [providerDropdownVisible, setProviderDropdownVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const todayRef = useRef(initialToday);
  const today = todayRef.current;
  const safeToday = useMemo(() => {
    const normalized = startOfDay(today) || normalizeToDate(today);
    if (normalized) return normalized;
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }, [today]);
  const [selectedDate, setSelectedDate] = useState(() => initialToday);
  const [tempDate, setTempDate] = useState(() => initialToday);
  const [pickerMinimumDate, setPickerMinimumDate] = useState(() => initialToday);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateError, setDateError] = useState('');
  const [confirmedDate, setConfirmedDate] = useState(null);
  const [slotsRequested, setSlotsRequested] = useState(false);
  const [slotsRequestToken, setSlotsRequestToken] = useState(0);

  const geocodeCacheRef = useRef(new Map());
  const providersLocationRef = useRef('');

  const selectedDateLabel = useMemo(
    () =>
      selectedDate
        ? formatMonthDayLabel(selectedDate)
        : t('booking.select_date_placeholder', 'Select appointment date'),
    [selectedDate, t],
  );

  const confirmedDateLabel = useMemo(() => formatDateDisplay(confirmedDate), [confirmedDate]);

  const geocodeWithCache = useCallback(async address => {
    const trimmed = sanitize(address);
    if (!trimmed) throw new Error('Address is required for geocoding');
    if (geocodeCacheRef.current.has(trimmed)) {
      return geocodeCacheRef.current.get(trimmed);
    }
    const result = await geocodeAddress(trimmed);
    geocodeCacheRef.current.set(trimmed, result);
    return result;
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      setErr('');
      geocodeCacheRef.current.clear();

      const storedPatientKey = patientKey || (await AsyncStorage.getItem('patientKey'));
      if (!storedPatientKey) {
        throw new Error(
          t(
            'booking.patient_key_missing',
            'We could not find your patient information. Please complete registration first.',
          ),
        );
      }

      const profile = await getPatientProfile(storedPatientKey);
      const patientZip = normalizePostalCode(profile?.Zip);

      const fullName = [sanitize(profile?.FirstName), sanitize(profile?.LastName)]
        .filter(Boolean)
        .join(' ')
        .trim();
      setPatientName(fullName);
      if (fullName) {
        try {
          await AsyncStorage.setItem('patientName', fullName);
        } catch {}
      }

      const addressParts = [
        sanitize(profile?.Address1),
        sanitize(profile?.Address2),
        sanitize(profile?.City),
        sanitize(profile?.State),
        patientZip,
      ].filter(Boolean);

      if (!addressParts.length) {
        throw new Error(
          t(
            'booking.patient_address_required',
            'We need your address to recommend nearby locations. Please update your profile.',
          ),
        );
      }

      const fullPatientAddress = addressParts.join(', ');
      setPatientAddress(fullPatientAddress);

      const rows = await fetchPracticeLocations();
      const mapped = rows
        .map(row => {
          const externalIpmKey = getExternalKey(row);
          const keyValue =
            row?.LocationKey ??
            row?.locationKey ??
            row?.Key ??
            row?.key ??
            row?.LocationID ??
            row?.LocationId ??
            row?.Id ??
            row?.id ??
            '';

          const location = {
            locationKey: keyValue != null ? String(keyValue) : '',
            name:
              sanitize(row?.LocationName) ||
              sanitize(row?.LocationDescription) ||
              sanitize(row?.Description) ||
              sanitize(row?.name) ||
              t('booking.unnamed_location', 'Clinic location'),
            externalIpmKey,
            address1: sanitize(row?.Address1 || row?.address1),
            address2: sanitize(row?.Address2 || row?.address2),
            city: sanitize(row?.City || row?.city),
            state: sanitize(row?.State || row?.state),
            zip: sanitize(row?.Zip || row?.zip),
            distanceMiles: null,
            distanceKm: null,
          };

          location.addressVariants = createAddressVariants(location);

          return location;
        })
        .filter(loc => loc.locationKey && Number(loc.externalIpmKey) > 0);

      if (!mapped.length) {
        throw new Error(t('booking.no_locations_available', 'No eligible locations were found.'));
      }

      const destinationAddresses = mapped.map(buildFullAddress);
      let matrixDistances = [];
      try {
        matrixDistances = await getDrivingDistancesMiles(fullPatientAddress, destinationAddresses);
      } catch (distanceErr) {
        console.warn('[InitialConsultation] distance matrix lookup failed', distanceErr);
      }

      const needsFallback = [];
      mapped.forEach((location, index) => {
        const matrixEntry = Array.isArray(matrixDistances) ? matrixDistances[index] : null;
        if (matrixEntry && typeof matrixEntry.miles === 'number') {
          location.distanceMiles = matrixEntry.miles;
          location.distanceKm = typeof matrixEntry.kilometers === 'number' ? matrixEntry.kilometers : null;
        } else {
          needsFallback.push(location);
        }
      });

      if (needsFallback.length) {
        let originCoords = null;
        const latNum = Number(patientLat);
        const lngNum = Number(patientLng);
        if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
          originCoords = { lat: latNum, lon: lngNum };
        } else {
          try {
            const coords = await geocodeWithCache(fullPatientAddress);
            originCoords = { lat: coords.lat, lon: coords.lon };
          } catch (geoErr) {
            console.warn('[InitialConsultation] unable to geocode patient address for fallback', geoErr);
          }
        }

        if (originCoords) {
          for (const location of needsFallback) {
            for (const variant of location.addressVariants || []) {
              const formatted = variant.filter(Boolean).join(', ');
              if (!formatted) continue;

              try {
                const coords = await geocodeWithCache(formatted);
                const kmDistance = distanceKm(originCoords.lat, originCoords.lon, coords.lat, coords.lon);
                location.distanceKm = kmDistance;
                location.distanceMiles = distanceMiles(kmDistance);
                break;
              } catch {
                // Try next variant.
              }
            }

            if (location.distanceKm == null) {
              console.warn('[InitialConsultation] fallback geocoding failed for', location.locationKey);
            }
          }
        }
      }

      mapped.forEach(loc => {
        if (loc.addressVariants) delete loc.addressVariants;
      });

      const sorted = [...mapped].sort((a, b) => {
        const aDist = typeof a.distanceMiles === 'number' ? a.distanceMiles : Number.POSITIVE_INFINITY;
        const bDist = typeof b.distanceMiles === 'number' ? b.distanceMiles : Number.POSITIVE_INFINITY;
        if (aDist !== bDist) return aDist - bDist;
        return a.name.localeCompare(b.name);
      });

      const nearest = sorted.slice(0, 3);
      setAllLocations(sorted);
      setTop3(nearest);
      setSelected(prev => {
        if (!prev) return nearest[0] ?? sorted[0] ?? null;
        const stillExists = sorted.find(loc => loc.locationKey === prev.locationKey);
        return stillExists || nearest[0] || sorted[0] || null;
      });
    } catch (error) {
      console.warn('[InitialConsultation] loadLocations failed', error);
      setErr(error?.message || t('booking.locations_error', 'Unable to load locations at this time.'));
      setAllLocations([]);
      setTop3([]);
      setSelected(null);
      setProviders([]);
      setSelectedProviderKey('');
      setProviderDropdownVisible(false);
      setProviderError('');
    } finally {
      setLoading(false);
    }
  }, [patientKey, patientLat, patientLng, geocodeWithCache, t]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLocations();
    } finally {
      setRefreshing(false);
    }
  }, [loadLocations]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const selectedLocationKey = toKeyString(selected?.locationKey);

  useEffect(() => {
    let isCancelled = false;
    const locationKey = selectedLocationKey;
    const locationChanged = locationKey !== providersLocationRef.current;
    console.log('[InitialConsultation] selected location key', locationKey);

    if (locationChanged) {
      setProviders([]);
      setSelectedProviderKey('');
      setProviderDropdownVisible(false);
    }

    setProviderError('');

    if (!locationKey) {
      setProvidersLoading(false);
      if (locationChanged) {
        providersLocationRef.current = '';
      }
      setProviderDropdownVisible(false);
      return () => {
        isCancelled = true;
      };
    }

    setProvidersLoading(true);

    (async () => {
      try {
        console.log('[InitialConsultation] providers request', {
          endpoint: '/provider/list',
          params: { locationKey },
        });
        const rawProviders = await fetchProvidersForLocation(locationKey);
        if (isCancelled) return;

        console.log(
          '[InitialConsultation] providers raw count',
          Array.isArray(rawProviders) ? rawProviders.length : 0,
        );
        if (Array.isArray(rawProviders) && rawProviders[0]) {
          console.log('[InitialConsultation] providers raw sample', rawProviders[0]);
        }

        // The API already filters by location, so no need to filter again
        const providersForLocation = Array.isArray(rawProviders) ? rawProviders : [];

        console.log(
          '[InitialConsultation] providers for location',
          providersForLocation.length,
          'for location',
          locationKey,
        );

        const mapped = providersForLocation
          .map(provider => {
            const internalKey = resolveInternalProviderKey(provider);
            const externalId = resolveExternalProviderId(provider);
            const key = internalKey || externalId;
            if (!key) {
              return null;
            }

            const first = sanitize(provider?.FirstName || provider?.firstName);
            const middle = sanitize(provider?.MiddleName || provider?.middleName);
            const last = sanitize(provider?.LastName || provider?.lastName);
            const baseName = [first, middle, last].filter(Boolean).join(' ');
            const fallbackName =
              sanitize(provider?.ProviderFullName) ||
              sanitize(provider?.ProviderName) ||
              sanitize(provider?.FullName) ||
              sanitize(provider?.Name) ||
              '';

            let displayName = baseName || fallbackName || t('booking.provider_name_fallback', 'Provider');

            const credentials =
              sanitize(provider?.Credentials) ||
              sanitize(provider?.Credential) ||
              sanitize(provider?.Suffix) ||
              sanitize(provider?.Title);

            if (displayName && credentials) {
              displayName = `${displayName}, ${credentials}`;
            }

            const detail =
              sanitize(provider?.Specialty) ||
              sanitize(provider?.Speciality) ||
              sanitize(provider?.Specialization) ||
              sanitize(provider?.Specialisation) ||
              sanitize(provider?.Department) ||
              sanitize(provider?.Discipline) ||
              sanitize(provider?.Role) ||
              sanitize(provider?.ProviderType) ||
              sanitize(provider?.Description) ||
              null;

            return {
              key,
              apiKey: internalKey || key,
              primaryKey: internalKey || key,
              providerKey: internalKey || key,
              externalIpmKey: externalId,
              externalId,
              name: displayName,
              detail,
              raw: provider,
            };
          })
          .filter(item => item && item.key && item.name);

        setProviders(mapped);
        console.log('[InitialConsultation] providers mapped', mapped.length);

        const previousSelection = locationChanged ? null : selectedProviderKey;
        const nextSelection = mapped.find(provider => provider.key === previousSelection)?.key ?? mapped[0]?.key ?? '';
        setSelectedProviderKey(nextSelection);
        setProviderDropdownVisible(false);
        providersLocationRef.current = locationKey;
      } catch (err) {
        if (isCancelled) return;
        setProviders([]);
        setSelectedProviderKey('');
        setProviderDropdownVisible(false);
        providersLocationRef.current = locationKey;
        setProviderError(err?.message || t('booking.providers_error', 'Unable to load providers right now.'));
      } finally {
        if (!isCancelled) {
          setProvidersLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedLocationKey, t]);

  const selectedProvider = useMemo(
    () => providers.find(provider => provider.key === selectedProviderKey) || null,
    [providers, selectedProviderKey],
  );

  const otherLocations = useMemo(() => {
    const topKeys = new Set(top3.map(loc => loc.locationKey));
    return allLocations.filter(loc => !topKeys.has(loc.locationKey));
  }, [allLocations, top3]);

  const selectedLocationInOther = useMemo(
    () => otherLocations.some(loc => loc.locationKey === selected?.locationKey),
    [otherLocations, selected?.locationKey],
  );

  const applyDateSelection = useCallback(
    pickedDate => {
      const normalizedPicked = startOfDay(pickedDate) || normalizeToDate(pickedDate);
      const baseDate = normalizedPicked || safeToday;
      if (!(baseDate instanceof Date)) {
        return;
      }

      const safeDate = baseDate < safeToday ? safeToday : baseDate;

      setSelectedDate(safeDate);
      setTempDate(safeDate);
      setDateError('');
    },
    [safeToday],
  );

  const handleOpenDatePicker = useCallback(() => {
    const minimum = safeToday instanceof Date ? safeToday : normalizeToDate(safeToday) || new Date();
    const fallbackDate = normalizeToDate(selectedDate) || minimum;
    const pickerValue = fallbackDate instanceof Date ? fallbackDate : minimum;
    const clampedValue = pickerValue < minimum ? minimum : pickerValue;

    const normalizedMinimum = minimum instanceof Date ? minimum : safeToday;
    setPickerMinimumDate(normalizedMinimum instanceof Date ? normalizedMinimum : new Date());
    setTempDate(clampedValue instanceof Date ? new Date(clampedValue) : normalizedMinimum);
    setShowDatePicker(true);
  }, [selectedDate, safeToday]);

  const handlePickerCancel = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const handlePickerConfirm = useCallback(
    nextDate => {
      const normalized = startOfDay(nextDate) || normalizeToDate(nextDate) || safeToday;
      if (normalized instanceof Date) {
        applyDateSelection(normalized);
        setTempDate(normalized);
      }
      setShowDatePicker(false);
    },
    [applyDateSelection, safeToday],
  );

  const handleConfirmDate = useCallback(() => {
    const normalized = startOfDay(selectedDate) || safeToday;

    if (!(normalized instanceof Date)) {
      setDateError(t('booking.date_required', 'Please choose a date before confirming.'));
      return;
    }

    if (normalized < safeToday) {
      setDateError(t('booking.date_in_past_error', 'Please choose a date that is today or later.'));
      setSelectedDate(safeToday);
      setTempDate(safeToday);
      return;
    }

    setSelectedDate(normalized);
    setDateError('');
    setConfirmedDate(normalized);
    setSlotsRequested(true);
    setSlots([]);
    setErr('');
    setLoadingSlots(false);
    setSlotsRequestToken(prev => prev + 1);
  }, [selectedDate, safeToday, t]);

  // ---- 2) Load slots from OLD AHC using selected.externalIpmKey ----
  useEffect(() => {
    let isCancelled = false;

    if (!slotsRequested || !confirmedDate) {
      if (!slotsRequested) {
        setSlots([]);
        setErr('');
      }
      setLoadingSlots(false);
      return () => {
        isCancelled = true;
      };
    }

    if (
      !selected?.externalIpmKey ||
      (!selectedProvider?.apiKey && !selectedProvider?.externalIpmKey)
    ) {
      setLoadingSlots(false);
      setSlots([]);
      return () => {
        isCancelled = true;
      };
    }

    (async () => {
      try {
        setLoadingSlots(true);
        setErr('');
        const baseCfg = await authHeaders();
        const startDate = startOfDay(confirmedDate) || safeToday;
        const endDate = startDate instanceof Date ? startDate : safeToday;
        const resolvedProviderKey = (() => {
          const externalKey = selectedProvider?.externalIpmKey;
          if (externalKey != null) {
            const numericValue = Number(externalKey);
            if (Number.isFinite(numericValue) && numericValue > 0) {
              return String(Math.trunc(numericValue));
            }
            if (typeof externalKey === 'string' && externalKey.trim()) {
              return externalKey.trim();
            }
          }
          return selectedProvider?.apiKey;
        })();

        const isEzDocsSlotsApi = FIRST_AVAILABLE_SLOTS_API_URL?.includes(
          'https://ezdocs.ahccenters.com/api/externalservice/cm',
        );

        const slotPath = isEzDocsSlotsApi
          ? '/appointment/getavailableslots'
          : '/appointment/slots';

        const cfg = isEzDocsSlotsApi
          ? {
              ...baseCfg,
              headers: { AppSecret: APP_SECRET },
            }
          : baseCfg;

        const params = isEzDocsSlotsApi
          ? {
              locationKey: selected.externalIpmKey,
              providerKey: resolvedProviderKey,
              fromDate: toYyyyMmDd(startDate),
              toDate: toYyyyMmDd(endDate),
              slotSize: '15',
              slotDuration: '30',
              practiceKey: '1',
            }
          : {
              [isEzDocsSlotsApi ? 'locationKey' : 'externalIpmKey']: selected.externalIpmKey,
              providerKey: resolvedProviderKey,
              visitTypeKey,
              startDate: toISO(startDate),
              endDate: toISO(endDate),
            };

        const requestUrl = `${FIRST_AVAILABLE_SLOTS_API_URL}${slotPath}`;
        const logHeaders = { ...(cfg?.headers || {}) };
        if (logHeaders.Token) logHeaders.Token = '[redacted]';
        if (logHeaders.AppSecret) logHeaders.AppSecret = '[redacted]';

        console.log('[InitialConsultation] slots request', {
          url: requestUrl,
          params,
          headers: logHeaders,
          timeout: cfg?.timeout,
        });

        const response = await axios.get(requestUrl, {
          params,
          ...cfg,
        });
        const { data, status } = response || {};
        console.log('[InitialConsultation] slots response', { status });
        if (isCancelled) return;
        const raw = extractSlotsArray(data);
        const mapped = normalizeSlotResults(raw);
        setSlots(mapped);
      } catch (e) {
        if (isCancelled) return;
        const errorStatus = e?.response?.status;
        const errorPayload = e?.response?.data || e?.message;
        console.warn('slots failed', { status: errorStatus, data: errorPayload });
        setErr(t('booking.slots_error', 'Unable to load time slots right now.'));
        setSlots([]);
      } finally {
        if (!isCancelled) {
          setLoadingSlots(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    slotsRequested,
    slotsRequestToken,
    confirmedDate,
    selected?.externalIpmKey,
    visitTypeKey,
    selectedProvider?.apiKey,
    selectedProvider?.externalIpmKey,
    safeToday,
    t,
  ]);

  const handleSelectLocation = useCallback(
    loc => {
      if (!loc) return;
      setSelected(loc);
      setSlots([]);
      setErr('');
      setLoadingSlots(false);
      setProviderDropdownVisible(false);
    },
    [],
  );

  const handleSelectProvider = useCallback(value => {
    setSelectedProviderKey(value || '');
    setProviderDropdownVisible(false);
    setSlots([]);
    setErr('');
    setLoadingSlots(false);
  }, []);

  // ---- 3) Book via ezdocs appointment endpoint ----
  const onBook = async slot => {
    try {
      if (!patientKey) return Alert.alert('Missing patient', 'Patient key is required.');
      if (!selectedProvider) {
        return Alert.alert('Select a provider', 'Please choose a provider before booking.');
      }

      const locationExternalKey = (() => {
        const rawKey = selected?.externalIpmKey ?? selected?.locationKey;
        if (rawKey == null) {
          return '';
        }
        const numeric = Number(rawKey);
        if (Number.isFinite(numeric) && numeric > 0) {
          return String(Math.trunc(numeric));
        }
        return typeof rawKey === 'string' ? rawKey.trim() : String(rawKey);
      })();

      const locationPrimaryKey = (() => {
        const rawKey = selected?.locationKey;
        if (rawKey == null) {
          return '';
        }
        const numeric = Number(rawKey);
        if (Number.isFinite(numeric) && numeric > 0) {
          return String(Math.trunc(numeric));
        }
        if (typeof rawKey === 'string' && rawKey.trim()) {
          return rawKey.trim();
        }
        return String(rawKey);
      })();

      const providerExternalKey = (() => {
        const externalKey = selectedProvider?.externalIpmKey;
        if (externalKey != null) {
          const numeric = Number(externalKey);
          if (Number.isFinite(numeric) && numeric > 0) {
            return String(Math.trunc(numeric));
          }
          if (typeof externalKey === 'string' && externalKey.trim()) {
            return externalKey.trim();
          }
        }
        const fallback = selectedProvider?.apiKey;
        if (fallback != null) {
          return String(fallback).trim();
        }
        return '';
      })();

      const providerPrimaryKey = (() => {
        const apiKey = selectedProvider?.apiKey;
        if (apiKey == null) {
          return '';
        }
        const numeric = Number(apiKey);
        if (Number.isFinite(numeric) && numeric > 0) {
          return String(Math.trunc(numeric));
        }
        if (typeof apiKey === 'string' && apiKey.trim()) {
          return apiKey.trim();
        }
        return String(apiKey);
      })();

      if (!locationExternalKey && !locationPrimaryKey) {
        return Alert.alert('Missing location', 'Location key is required to book this appointment.');
      }

      if (!locationExternalKey) {
        return Alert.alert(
          'Missing external location key',
          'Unable to determine the location identifier required for booking.',
        );
      }

      if (!providerPrimaryKey) {
        return Alert.alert('Missing provider', 'Provider key is required to book this appointment.');
      }

      const appointmentDateTime =
        slot?.bookingDateTime ||
        buildAppointmentDateTime(slot?.dateLabel, slot?.timeLabel, slot?.start);

      if (!appointmentDateTime) {
        return Alert.alert('Missing time', 'Unable to determine the appointment time for booking.');
      }

      const appointmentDate = parseAppointmentDateTime(appointmentDateTime);
      const confirmedTimeLabel =
        slot?.timeLabel || (appointmentDate ? formatTimeFromDate(appointmentDate) : '');
      const confirmedDateIso = appointmentDate instanceof Date ? appointmentDate.toISOString() : '';
      const confirmedDateLabel = slot?.dateLabel || (appointmentDate ? formatDateDisplay(appointmentDate) : '');

      const navigationPayload = {
        slot: slot || null,
        appointmentDateTime,
        visitTypeKey: visitTypeKey != null ? String(visitTypeKey) : undefined,
        patientKey: String(patientKey),
        patientName,
        time: confirmedTimeLabel,
        date: confirmedDateIso || confirmedDateLabel,
        dateLabel: confirmedDateLabel,
        location: {
          key: locationPrimaryKey,
          label: selected?.name || '',
          address1: selected?.address1 || '',
          address2: selected?.address2 || '',
          city: selected?.city || '',
          state: selected?.state || '',
          zip: selected?.zip || '',
          primaryKey: locationPrimaryKey,
          externalKey: locationExternalKey,
          externalIpmKey: locationExternalKey,
          locationKey: locationPrimaryKey,
        },
        provider: {
          key: providerPrimaryKey,
          label: selectedProvider?.name || '',
          detail: selectedProvider?.detail || '',
          primaryKey: providerPrimaryKey,
          externalKey: providerExternalKey,
          externalIpmKey: providerExternalKey,
        },
      };

      if (typeof navigation?.replace === 'function') {
        navigation.replace('Confirm', navigationPayload);
      } else if (typeof navigation?.navigate === 'function') {
        navigation.navigate('Confirm', navigationPayload);
      }
    } catch (e) {
      console.warn('prepare booking failed', e);
      Alert.alert('Booking unavailable', 'Try another time slot.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.wrapper}>
        <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <ActivityIndicator size="large" color="#2A7D8F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.h1}>Initial Consultation</Text>

        <View style={styles.dateSection}>
          <Text style={styles.dateSectionTitle}>
            {t('booking.select_appointment_date', 'Select an appointment date')}
          </Text>
          <View style={styles.datePickerRow}>
            <TouchableOpacity
              style={[styles.datePickerButton, styles.datePickerButtonFirst]}
              onPress={handleOpenDatePicker}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={18} color="#2A7D8F" style={styles.datePickerIcon} />
              <Text style={styles.datePickerButtonText}>{selectedDateLabel}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.dateConfirmButton} onPress={handleConfirmDate} activeOpacity={0.85}>
            <Text style={styles.dateConfirmButtonText}>
              {t('booking.confirm_date', 'Confirm date')}
            </Text>
          </TouchableOpacity>
          {dateError ? (
            <Text style={styles.dateErrorText}>{dateError}</Text>
          ) : slotsRequested && confirmedDate ? (
            <Text style={styles.dateStatusText}>
              {t('booking.showing_slots_for_date', 'Showing times for {{date}}', {
                date: confirmedDateLabel,
              })}
            </Text>
          ) : (
            <Text style={styles.dateHintText}>
              {t(
                'booking.date_picker_hint',
                'Pick a date and confirm to see available times.',
              )}
            </Text>
          )}
        </View>

        {patientAddress ? (
          <View style={styles.patientCard}>
            <Text style={styles.patientLabel}>Your address</Text>
            <Text style={styles.patientValue}>{patientAddress}</Text>
            <Text style={styles.patientHint}>
              Distances below are calculated using Google Maps from your registration address.
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Top nearby locations</Text>
        {top3.length ? (
          top3.map(loc => {
            const isSelected = selected?.locationKey === loc.locationKey;
            return (
              <TouchableOpacity
                key={loc.locationKey}
                style={[styles.locationCard, isSelected && styles.locationCardSelected]}
                onPress={() => handleSelectLocation(loc)}
                activeOpacity={0.85}
              >
                <View style={styles.locationHeader}>
                  <Text style={styles.locationName}>{loc.name}</Text>
                  {typeof loc.distanceMiles === 'number' ? (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{`${loc.distanceMiles.toFixed(1)} mi`}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.locationAddress}>
                  {[loc.address1, loc.address2, loc.city, loc.state, loc.zip].filter(Boolean).join('\n')}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.noSlots}>No nearby locations found.</Text>
        )}

        {otherLocations.length ? (
          <View style={styles.dropdownSection}>
            <Text style={styles.section}>Other locations</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={selectedLocationInOther ? selected?.locationKey : ''}
                onValueChange={val => {
                  const loc = otherLocations.find(x => x.locationKey === val);
                  if (loc) {
                    handleSelectLocation(loc);
                  }
                }}
              >
                <Picker.Item label="Select a location" value="" />
                {otherLocations.map(l => (
                  <Picker.Item
                    key={l.locationKey}
                    label={`${l.name}${
                      typeof l.distanceMiles === 'number' ? ` (${l.distanceMiles.toFixed(1)} mi)` : ''
                    }`}
                    value={l.locationKey}
                  />
                ))}
              </Picker>
            </View>
          </View>
        ) : null}

        {selected ? (
          <View style={styles.selectedSummary}>
            <Text style={styles.summaryHeading}>Selected location</Text>
            <Text style={styles.summaryName}>{selected.name}</Text>
            <Text style={styles.summaryAddress}>{formatAddress(selected)}</Text>
            {typeof selected.distanceMiles === 'number' ? (
              <Text style={styles.summaryDistance}>{`${selected.distanceMiles.toFixed(1)} miles away`}</Text>
            ) : (
              <Text style={styles.summaryDistanceMuted}>Distance unavailable</Text>
            )}

            <View style={styles.summaryDateSection}>
              <Text style={styles.summaryHeading}>
                {t('booking.selected_date', 'Selected date')}
              </Text>
              {confirmedDate ? (
                <Text style={styles.summaryDateValue}>{confirmedDateLabel}</Text>
              ) : (
                <Text style={styles.summaryDatePending}>
                  {t('booking.select_date_prompt', 'Confirm a date to continue.')}
                </Text>
              )}
            </View>

            <View style={styles.providerSection}>
              <Text style={styles.providerHeading}>
                {t('booking.choose_provider', 'Choose a provider')}
              </Text>
              {providersLoading ? (
                <View style={styles.providerLoadingRow}>
                  <ActivityIndicator size="small" color="#2A7D8F" />
                  <Text style={styles.providerLoadingText}>Loading providers...</Text>
                </View>
              ) : providerError ? (
                <View style={styles.providerErrorBox}>
                  <Text style={styles.providerErrorText}>{providerError}</Text>
                </View>
              ) : providers.length ? (
                <>
                  <TouchableOpacity
                    style={styles.providerDropdownTrigger}
                    onPress={() => setProviderDropdownVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.providerDropdownLabel,
                        !selectedProvider && styles.providerDropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedProvider
                        ? selectedProvider.name
                        : t('booking.select_provider', 'Select a provider')}
                    </Text>
                    <Ionicons
                      name={providerDropdownVisible ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#2A7D8F"
                    />
                  </TouchableOpacity>
                  {!selectedProvider ? (
                    <Text style={styles.providerPrompt}>Select a provider to see more details.</Text>
                  ) : null}
                  {selectedProvider?.detail ? (
                    <Text style={styles.providerDetail}>{selectedProvider.detail}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.providerEmpty}>No providers available for this location.</Text>
              )}
            </View>
          </View>
        ) : null}


        <Text style={styles.section}>Available time slots</Text>
        {!slotsRequested ? (
          <Text style={styles.slotHint}>
            {t('booking.confirm_date_for_slots', 'Confirm a date to view available time slots.')}
          </Text>
        ) : !selectedProvider ? (
          <Text style={styles.slotHint}>
            {t('booking.slots_select_provider', 'Select a provider to view available time slots.')}
          </Text>
        ) : loadingSlots ? (
          <ActivityIndicator size="small" color="#2A7D8F" />
        ) : slots.length === 0 ? (
          <Text style={styles.noSlots}>
            {t('booking.no_slots_for_date', 'No time slots are available for the selected date.')}
          </Text>
        ) : (
          <View style={styles.slotCarouselWrapper}>
            {selectedProvider?.name ? (
              <Text style={styles.slotProviderBanner}>{selectedProvider.name}</Text>
            ) : null}
            <FlatList
              data={slots}
              keyExtractor={item => String(item.id)}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.slotRow}
              renderItem={({ item, index }) => {
                const dateLabel = item.dateLabel || '';
                const timeLabel = item.timeLabel || item.start;
                const cardStyle = [styles.slotCard];

                if ((index + 1) % 3 !== 0) {
                  cardStyle.push(styles.slotCardSpacing);
                }

                return (
                  <TouchableOpacity style={cardStyle} onPress={() => onBook(item)}>
                    <Text style={styles.slotTime}>{timeLabel}</Text>
                    {dateLabel ? <Text style={styles.slotDate}>{dateLabel}</Text> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {!!err && <Text style={styles.errorText}>{err}</Text>}
      </ScrollView>

      <Modal
        visible={providerDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProviderDropdownVisible(false)}
      >
        <View style={styles.providerDropdownOverlay}>
          <TouchableWithoutFeedback onPress={() => setProviderDropdownVisible(false)}>
            <View style={styles.providerDropdownBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.providerDropdownCard}>
            <Text style={styles.providerDropdownTitle}>
              {t('booking.choose_provider', 'Choose a provider')}
            </Text>
            <ScrollView style={styles.providerDropdownList}>
              <TouchableOpacity
                style={[
                  styles.providerDropdownOption,
                  !selectedProvider && styles.providerDropdownOptionSelected,
                ]}
                onPress={() => handleSelectProvider('')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.providerDropdownOptionText,
                    !selectedProvider && styles.providerDropdownOptionTextSelected,
                  ]}
                >
                  {t('booking.select_provider', 'Select a provider')}
                </Text>
              </TouchableOpacity>
              {providers.map(provider => {
                const isSelected = provider.key === selectedProviderKey;
                return (
                  <TouchableOpacity
                    key={provider.key}
                    style={[
                      styles.providerDropdownOption,
                      isSelected && styles.providerDropdownOptionSelected,
                    ]}
                    onPress={() => handleSelectProvider(provider.key)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.providerDropdownOptionText,
                        isSelected && styles.providerDropdownOptionTextSelected,
                      ]}
                    >
                      {provider.name}
                    </Text>
                    {provider.detail ? (
                      <Text style={styles.providerDropdownOptionDetail}>{provider.detail}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.providerDropdownCancelButton}
              onPress={() => setProviderDropdownVisible(false)}
            >
              <Text style={styles.providerDropdownCancelText}>{t('cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SimpleDatePickerModal
        visible={showDatePicker}
        initialDate={normalizeToDate(tempDate) || pickerMinimumDate || safeToday}
        minimumDate={pickerMinimumDate instanceof Date ? pickerMinimumDate : safeToday}
        title={t('booking.select_date', 'Select date')}
        cancelLabel={t('booking.cancel', 'Cancel')}
        confirmLabel={t('booking.confirm', 'Confirm')}
        monthLabel={t('date_picker.month', 'Month')}
        dayLabel={t('date_picker.day', 'Day')}
        yearLabel={t('date_picker.year', 'Year')}
        onCancel={handlePickerCancel}
        onConfirm={handlePickerConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20 },
  h1: { fontSize: 26, color: '#2A7D8F', textAlign: 'center', marginBottom: 16, fontWeight: '700' },
  dateSection: {
    backgroundColor: '#F5FBFD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C9E3EA',
  },
  dateSectionTitle: { fontSize: 16, color: '#1B3A4B', fontWeight: '600', marginBottom: 12 },
  datePickerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F3F7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#C9E3EA',
  },
  datePickerButtonFirst: { marginRight: 8 },
  datePickerIcon: { marginRight: 8 },
  datePickerButtonText: { color: '#1B3A4B', fontWeight: '600' },
  dateConfirmButton: {
    backgroundColor: '#2A7D8F',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  dateConfirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dateErrorText: { color: '#B00020', marginTop: 6, fontWeight: '600' },
  dateHintText: { color: '#4A6C82', marginTop: 6 },
  dateStatusText: { color: '#2A7D8F', marginTop: 6, fontWeight: '600' },
  patientCard: { backgroundColor: '#E4F3F7', borderRadius: 16, padding: 16, marginBottom: 16 },
  patientLabel: { color: '#2A7D8F', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  patientValue: { color: '#1B3A4B', fontSize: 16, marginTop: 6, lineHeight: 22 },
  patientHint: { color: '#4A6C82', fontSize: 13, marginTop: 10 },
  section: { color: '#2A7D8F', fontWeight: '700', marginBottom: 8, fontSize: 16 },
  locationCard: {
    backgroundColor: '#F5FBFD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  locationCardSelected: { backgroundColor: '#DDF1F6', borderColor: '#2A7D8F' },
  locationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationName: { color: '#1B3A4B', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12 },
  distanceBadge: { backgroundColor: '#2A7D8F', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  distanceText: { color: '#fff', fontWeight: '600' },
  locationAddress: { marginTop: 8, color: '#34515E', lineHeight: 20 },
  dropdownSection: { marginTop: 16, marginBottom: 8 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#C9E3EA',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F5FBFD',
    marginBottom: 16,
  },
  slotCarouselWrapper: { marginTop: 8 },
  slotRow: {
    paddingHorizontal: 4,
    marginBottom: 12,
    justifyContent: 'flex-start',
  },
  slotCard: {
    backgroundColor: '#EEF7F9',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flex: 1,
    marginBottom: 12,
  },
  slotCardSpacing: { marginRight: 12 },
  slotTime: { color: '#1B3A4B', fontSize: 20, fontWeight: '700' },
  slotDate: { color: '#34515E', marginTop: 4, fontSize: 14 },
  slotProviderBanner: {
    color: '#2A7D8F',
    fontWeight: '700',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  selectedSummary: { marginTop: 12, backgroundColor: '#EEF7F9', borderRadius: 16, padding: 18 },
  summaryHeading: { fontSize: 14, color: '#2A7D8F', fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  summaryName: { fontSize: 18, color: '#1B3A4B', fontWeight: '700', marginBottom: 6 },
  summaryAddress: { color: '#34515E', lineHeight: 20 },
  summaryDistance: { marginTop: 8, color: '#2A7D8F', fontWeight: '600' },
  summaryDistanceMuted: { marginTop: 8, color: '#A0AEB4', fontStyle: 'italic' },
  summaryDateSection: { marginTop: 16 },
  summaryDateValue: { color: '#1B3A4B', fontSize: 16, fontWeight: '600', marginTop: 4 },
  summaryDatePending: { color: '#4A6C82', fontStyle: 'italic', marginTop: 4 },
  providerSection: { marginTop: 18 },
  providerHeading: { fontSize: 16, color: '#1B3A4B', fontWeight: '600', marginBottom: 8 },
  providerLoadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  providerLoadingText: { marginLeft: 10, color: '#4A6C82' },
  providerErrorBox: { backgroundColor: '#FDECEA', borderRadius: 14, padding: 16 },
  providerErrorText: { color: '#C62828', textAlign: 'center' },
  providerDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9E3EA',
    backgroundColor: '#F5FBFD',
  },
  providerDropdownLabel: {
    flex: 1,
    color: '#1B3A4B',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
  },
  providerDropdownPlaceholder: {
    color: '#4A6C82',
    fontWeight: '400',
  },
  providerDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 34, 47, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  providerDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  providerDropdownCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#0A2230',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  providerDropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B3A4B',
    marginBottom: 12,
    textAlign: 'center',
  },
  providerDropdownList: {
    maxHeight: 320,
  },
  providerDropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  providerDropdownOptionSelected: {
    backgroundColor: '#E3F3F8',
  },
  providerDropdownOptionText: {
    color: '#1B3A4B',
    fontSize: 15,
    fontWeight: '600',
  },
  providerDropdownOptionTextSelected: {
    color: '#0F5C6E',
  },
  providerDropdownOptionDetail: {
    marginTop: 4,
    color: '#4A6C82',
    fontSize: 13,
  },
  providerDropdownCancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F0F6F8',
  },
  providerDropdownCancelText: {
    textAlign: 'center',
    color: '#2A7D8F',
    fontWeight: '600',
    fontSize: 15,
  },
  providerPrompt: { marginTop: 10, color: '#4A6C82', fontStyle: 'italic' },
  providerDetail: { marginTop: 10, color: '#4A6C82' },
  providerEmpty: { color: '#4A6C82', fontStyle: 'italic' },
  slotHint: { color: '#4A6C82', textAlign: 'center', marginBottom: 8, marginTop: 4 },
  noSlots: { color: '#2A7D8F', textAlign: 'center', marginTop: 8 },
  errorText: { color: '#B00020', textAlign: 'center', marginTop: 12, fontWeight: '600' },
});
