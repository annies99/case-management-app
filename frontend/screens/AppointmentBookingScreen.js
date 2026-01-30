// frontend/screens/AppointmentBookingScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getPatientProfile } from '../services/authService';
import {
  geocodeAddress,
  distanceKm,
  distanceMiles,
  getDrivingDistancesMiles,
} from '../services/geoService';
import { fetchPracticeLocations, getExternalKey } from '../services/locationService';
import { fetchProvidersForLocation } from '../services/providerService';
import { fetchAvailableSlots } from '../services/slotService';
import SimpleDatePickerModal from '../components/SimpleDatePickerModal';

const formatAddress = ({ address1, address2, city, state, zip }) => {
  const lines = [];
  const primary = [address1, address2].filter(Boolean).join(' ').trim();
  if (primary) lines.push(primary);
  const cityStateZip = [
    city?.trim(),
    [state, zip].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);
  if (cityStateZip.length) lines.push(cityStateZip.join(', '));
  return lines.join('\n');
};

const sanitize = value => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value).trim();
  }
  return '';
};

const pickFirstDefined = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }
  return undefined;
};

const asArray = value => (Array.isArray(value) ? value : []);

const coerceBoolean = value => {
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return null;
    }
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['true', 't', 'yes', 'y', '1', 'available', 'open'].includes(normalized)) {
      return true;
    }
    if (['false', 'f', 'no', 'n', '0', 'unavailable', 'closed'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const firstNonEmptyString = (...candidates) => {
  for (const candidate of candidates) {
    const str = sanitize(candidate);
    if (str) {
      return str;
    }
  }
  return '';
};

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

const isDateObject = value => (
  !!value && typeof value.getTime === 'function' && !Number.isNaN(value.getTime())
);

const startOfDay = date => {
  if (!isDateObject(date)) return null;
  const normalized = new Date(date.getTime());
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const cloneDate = date => (
  isDateObject(date) ? new Date(date.getTime()) : null
);

const formatDateDisplay = date => {
  if (!isDateObject(date)) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch (err) {
    return date.toDateString();
  }
};

const formatDateRangeDisplay = (startDate, endDate) => {
  const hasStart = isDateObject(startDate);
  const hasEnd = isDateObject(endDate);

  if (hasStart && hasEnd) {
    const startLabel = formatDateDisplay(startDate);
    const endLabel = formatDateDisplay(endDate);
    if (startLabel && startLabel === endLabel) {
      return startLabel;
    }
    if (startLabel && endLabel) {
      return `${startLabel} - ${endLabel}`;
    }
    return startLabel || endLabel || '';
  }

  if (hasStart) {
    return formatDateDisplay(startDate);
  }

  if (hasEnd) {
    return formatDateDisplay(endDate);
  }

  return '';
};

const parseDateToken = value => {
  const trimmed = sanitize(value);
  if (!trimmed) return null;

  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
};

const combineDateAndTime = (baseDate, hours, minutes) => {
  if (isDateObject(baseDate)) {
    const combined = new Date(baseDate.getTime());
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }

  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  today.setSeconds(0, 0);
  return today;
};

const parseTimeToken = (value, baseDate) => {
  const trimmed = sanitize(value);
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed)) {
    const hours = Number(trimmed.slice(0, 2));
    const minutes = Number(trimmed.slice(2, 4));
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return combineDateAndTime(baseDate, hours, minutes);
    }
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    const [hoursStr, minutesStr] = trimmed.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return combineDateAndTime(baseDate, hours, minutes);
    }
  }

  const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2] ?? '0');
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      const suffix = amPmMatch[3].toUpperCase();
      if (suffix === 'PM' && hours < 12) {
        hours += 12;
      }
      if (suffix === 'AM' && hours === 12) {
        hours = 0;
      }
      return combineDateAndTime(baseDate, hours, minutes);
    }
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
};

const parseDateTimeToken = value => {
  const trimmed = sanitize(value);
  if (!trimmed) return null;

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  if (/^\d{12}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    const hour = Number(trimmed.slice(8, 10));
    const minute = Number(trimmed.slice(10, 12));
    if (
      !Number.isNaN(year) &&
      !Number.isNaN(month) &&
      !Number.isNaN(day) &&
      !Number.isNaN(hour) &&
      !Number.isNaN(minute)
    ) {
      return new Date(year, month - 1, day, hour, minute, 0, 0);
    }
  }

  return null;
};

const formatTimeLabel = date => {
  if (!isDateObject(date)) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (err) {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }
};

const expandSlotEntry = (slot, index, fallbackDate) => {
  if (!slot || typeof slot !== 'object') {
    return [];
  }

  const parentAvailability = coerceBoolean(
    pickFirstDefined(
      slot?.IsAvailable,
      slot?.isAvailable,
      slot?.Available,
      slot?.available,
      slot?.Availability,
      slot?.availability,
      slot?.IsOpen,
      slot?.isOpen,
      slot?.Open,
      slot?.open,
    ),
  );

  if (parentAvailability === false) {
    return [];
  }

  const appointmentSlotsPrimary = asArray(slot?.AppointmentSlots);
  const appointmentSlotsSecondary = asArray(slot?.appointmentSlots);
  const appointmentSlots = appointmentSlotsPrimary.length
    ? appointmentSlotsPrimary
    : appointmentSlotsSecondary;

  const appointmentTimesPrimary = asArray(slot?.AppointmentTime);
  const appointmentTimesSecondary = asArray(slot?.appointmentTime);
  const appointmentTimes = appointmentTimesPrimary.length
    ? appointmentTimesPrimary
    : appointmentTimesSecondary;

  const baseDateValue =
    pickFirstDefined(
      slot?.AppointmentDate,
      slot?.appointmentDate,
      slot?.SlotDate,
      slot?.slotDate,
      slot?.Date,
      slot?.date,
    ) ?? (isDateObject(fallbackDate) ? fallbackDate : null);

  const keySeed =
    toKeyString(slot?.SlotKey) ||
    toKeyString(slot?.slotKey) ||
    toKeyString(slot?.SlotID) ||
    toKeyString(slot?.SlotId) ||
    toKeyString(slot?.AppointmentSlotId) ||
    toKeyString(slot?.AppointmentSlotID) ||
    toKeyString(slot?.Id) ||
    toKeyString(slot?.id) ||
    toKeyString(slot?.Key) ||
    toKeyString(slot?.key) ||
    `slot-${index}`;

  const expanded = [];

  const hasSlotArrays = appointmentSlots.length || appointmentTimes.length;
  if (hasSlotArrays) {
    const total = Math.max(appointmentSlots.length, appointmentTimes.length);
    for (let i = 0; i < total; i += 1) {
      const slotRange = sanitize(i < appointmentSlots.length ? appointmentSlots[i] : '');
      const timeValue = sanitize(i < appointmentTimes.length ? appointmentTimes[i] : '');

      if (!slotRange && !timeValue) {
        continue;
      }

      let startDisplay = '';
      let endDisplay = '';

      if (slotRange && slotRange.includes('-')) {
        const parts = slotRange.split('-');
        const startPart = parts.shift();
        const endPart = parts.join('-');
        startDisplay = sanitize(startPart);
        endDisplay = sanitize(endPart);
      }

      if (!startDisplay && timeValue) {
        startDisplay = timeValue;
      }

      if (!startDisplay && slotRange) {
        startDisplay = slotRange;
      }

      const label = slotRange || timeValue;
      if (!label) {
        continue;
      }

      const generatedKey = `${keySeed}-${i}`;
      const startForFields = startDisplay || label;

      expanded.push({
        ...slot,
        SlotKey: generatedKey,
        slotKey: generatedKey,
        SlotDate: baseDateValue,
        slotDate: baseDateValue,
        DisplayText: label,
        SlotDisplayText: label,
        SlotTimeDisplay: label,
        SlotStartTime: startForFields,
        SlotEndTime: endDisplay,
        StartTimeDisplay: startForFields,
        EndTimeDisplay: endDisplay,
        StartTime: startForFields,
        EndTime: endDisplay,
      });
    }
  }

  if (!expanded.length) {
    const nestedSources = [
      asArray(slot?.Slots),
      asArray(slot?.slots),
      asArray(slot?.AvailableSlots),
      asArray(slot?.availableSlots),
      asArray(slot?.SlotList),
      asArray(slot?.slotList),
      asArray(slot?.SlotDetails),
      asArray(slot?.slotDetails),
      asArray(slot?.Times),
      asArray(slot?.times),
    ];

    const nestedEntries = [];
    nestedSources.forEach(source => {
      source.forEach(entry => {
        nestedEntries.push(entry);
      });
    });

    nestedEntries.forEach((entry, nestedIndex) => {
      if (entry == null) {
        return;
      }

      if (typeof entry !== 'object') {
        const label = sanitize(entry);
        if (!label) {
          return;
        }

        let startDisplay = '';
        let endDisplay = '';
        if (label.includes('-')) {
          const parts = label.split('-');
          const startPart = parts.shift();
          const endPart = parts.join('-');
          startDisplay = sanitize(startPart);
          endDisplay = sanitize(endPart);
        }

        if (!startDisplay) {
          startDisplay = label;
        }

        const generatedKey = `${keySeed}-nested-${nestedIndex}`;
        const startForFields = startDisplay || label;

        expanded.push({
          ...slot,
          SlotKey: generatedKey,
          slotKey: generatedKey,
          SlotDate: baseDateValue,
          slotDate: baseDateValue,
          DisplayText: label,
          SlotDisplayText: label,
          SlotTimeDisplay: label,
          SlotStartTime: startForFields,
          SlotEndTime: endDisplay,
          StartTimeDisplay: startForFields,
          EndTimeDisplay: endDisplay,
          StartTime: startForFields,
          EndTime: endDisplay,
        });
        return;
      }

      const availability = coerceBoolean(
        pickFirstDefined(
          entry?.IsAvailable,
          entry?.isAvailable,
          entry?.Available,
          entry?.available,
          entry?.Availability,
          entry?.availability,
          entry?.IsOpen,
          entry?.isOpen,
          entry?.Open,
          entry?.open,
          entry?.Status,
          entry?.status,
        ),
      );

      if (availability === false) {
        return;
      }

      const label = firstNonEmptyString(
        entry?.DisplayText,
        entry?.displayText,
        entry?.SlotDisplayText,
        entry?.slotDisplayText,
        entry?.SlotTimeDisplay,
        entry?.slotTimeDisplay,
        entry?.TimeRange,
        entry?.timeRange,
        entry?.Description,
        entry?.Notes,
      );

      const startDisplay = firstNonEmptyString(
        entry?.StartTimeDisplay,
        entry?.startTimeDisplay,
        entry?.SlotStartTime,
        entry?.slotStartTime,
        entry?.StartTime,
        entry?.startTime,
        entry?.FromTime,
        entry?.fromTime,
        entry?.Time,
        entry?.time,
      );

      const endDisplay = firstNonEmptyString(
        entry?.EndTimeDisplay,
        entry?.endTimeDisplay,
        entry?.SlotEndTime,
        entry?.slotEndTime,
        entry?.EndTime,
        entry?.endTime,
        entry?.ToTime,
        entry?.toTime,
      );

      let resolvedLabel = label;
      if (!resolvedLabel) {
        if (startDisplay && endDisplay) {
          resolvedLabel = `${startDisplay} - ${endDisplay}`;
        } else if (startDisplay) {
          resolvedLabel = startDisplay;
        }
      }

      if (!resolvedLabel) {
        return;
      }

      const generatedKey =
        toKeyString(
          pickFirstDefined(
            entry?.SlotKey,
            entry?.slotKey,
            entry?.SlotID,
            entry?.slotID,
            entry?.SlotId,
            entry?.slotId,
            entry?.Id,
            entry?.id,
            entry?.Key,
            entry?.key,
          ),
        ) || `${keySeed}-nested-${nestedIndex}`;

      const nestedDate =
        pickFirstDefined(
          entry?.SlotDate,
          entry?.slotDate,
          entry?.AppointmentDate,
          entry?.appointmentDate,
          baseDateValue,
        ) ?? (isDateObject(fallbackDate) ? fallbackDate : null);

      const startForFields = startDisplay || resolvedLabel;

      expanded.push({
        ...slot,
        ...entry,
        SlotKey: generatedKey,
        slotKey: generatedKey,
        SlotDate: nestedDate,
        slotDate: nestedDate,
        DisplayText: resolvedLabel,
        SlotDisplayText: resolvedLabel,
        SlotTimeDisplay: resolvedLabel,
        SlotStartTime: startForFields,
        SlotEndTime: endDisplay,
        StartTimeDisplay: startForFields,
        EndTimeDisplay: endDisplay,
        StartTime: startForFields,
        EndTime: endDisplay,
      });
    });
  }

  return expanded.length ? expanded : [slot];
};

const normalizeSlotOption = (slot, index, fallbackDate) => {
  if (!slot) return null;

  const keyCandidates = [
    slot?.SlotKey,
    slot?.slotKey,
    slot?.SlotID,
    slot?.SlotId,
    slot?.slotId,
    slot?.AppointmentSlotId,
    slot?.AppointmentSlotID,
    slot?.Id,
    slot?.id,
    slot?.Key,
    slot?.key,
  ];

  let key = '';
  for (const candidate of keyCandidates) {
    const str = toKeyString(candidate);
    if (str) {
      key = str;
      break;
    }
  }

  if (!key) {
    key = `slot-${index}`;
  }

  const slotDate =
    parseDateToken(
      slot?.SlotDate ??
        slot?.slotDate ??
        slot?.Date ??
        slot?.date ??
        slot?.AppointmentDate ??
        slot?.appointmentDate ??
        slot?.FromDate ??
        slot?.fromDate ??
        slot?.StartDate ??
        slot?.startDate,
    ) ||
    fallbackDate ||
    null;

  const explicitStart =
    parseDateTimeToken(
      slot?.StartDateTime ??
        slot?.startDateTime ??
        slot?.StartDate ??
        slot?.startDate ??
        slot?.SlotDateTime ??
        slot?.slotDateTime,
    ) || null;

  const explicitEnd =
    parseDateTimeToken(
      slot?.EndDateTime ??
        slot?.endDateTime ??
        slot?.EndDate ??
        slot?.endDate ??
        slot?.SlotEndDateTime ??
        slot?.slotEndDateTime,
    ) || null;

  const startTimeValue =
    slot?.StartTimeDisplay ??
    slot?.StartTime ??
    slot?.SlotStartTime ??
    slot?.slotStartTime ??
    slot?.SlotTime ??
    slot?.slotTime ??
    slot?.FromTime ??
    slot?.fromTime ??
    slot?.Time ??
    slot?.time ??
    null;

  const endTimeValue =
    slot?.EndTimeDisplay ??
    slot?.EndTime ??
    slot?.SlotEndTime ??
    slot?.slotEndTime ??
    slot?.ToTime ??
    slot?.toTime ??
    null;

  const startDateTime = explicitStart || parseTimeToken(startTimeValue, slotDate || fallbackDate);
  const endDateTime = explicitEnd || parseTimeToken(endTimeValue, slotDate || fallbackDate);

  const startLabel = formatTimeLabel(startDateTime) || sanitize(startTimeValue);
  const endLabel = formatTimeLabel(endDateTime) || sanitize(endTimeValue);

  let label =
    sanitize(slot?.DisplayText) ||
    sanitize(slot?.displayText) ||
    sanitize(slot?.SlotDisplayText) ||
    sanitize(slot?.slotDisplayText) ||
    sanitize(slot?.SlotTimeDisplay) ||
    sanitize(slot?.slotTimeDisplay) ||
    sanitize(slot?.TimeRange) ||
    sanitize(slot?.timeRange) ||
    '';

  if (!label) {
    if (startLabel && endLabel) {
      label = `${startLabel} - ${endLabel}`;
    } else if (startLabel) {
      label = startLabel;
    }
  }

  if (!label) {
    label = sanitize(slot?.Description) || sanitize(slot?.Notes) || '';
  }

  return {
    key,
    label,
    startDateTime,
    endDateTime,
    slotDate: slotDate || fallbackDate || null,
    startLabel: startLabel || '',
    endLabel: endLabel || '',
    raw: slot,
  };
};

const normalizeSlotOptions = (slots, fallbackDate) => {
  if (!Array.isArray(slots)) return [];
  const seen = new Set();
  return slots
    .flatMap((slot, index) => expandSlotEntry(slot, index, fallbackDate))
    .map((slot, index) => normalizeSlotOption(slot, index, fallbackDate))
    .filter(option => option && option.key && option.label)
    .filter(option => {
      const dateKey = isDateObject(option.slotDate)
        ? option.slotDate.toISOString().slice(0, 10)
        : '';
      const labelKey = option.label.trim();
      if (!labelKey) {
        return false;
      }
      const signature = `${dateKey}__${labelKey}`;
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    })
    .sort((a, b) => {
      const aTime = isDateObject(a.startDateTime)
        ? a.startDateTime.getTime()
        : isDateObject(a.slotDate)
        ? a.slotDate.getTime()
        : Number.POSITIVE_INFINITY;
      const bTime = isDateObject(b.startDateTime)
        ? b.startDateTime.getTime()
        : isDateObject(b.slotDate)
        ? b.slotDate.getTime()
        : Number.POSITIVE_INFINITY;

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.label.localeCompare(b.label);
    });
};

export default function AppointmentBookingScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topLocations, setTopLocations] = useState([]);
  const [otherLocations, setOtherLocations] = useState([]);
  const [selectedLocationKey, setSelectedLocationKey] = useState(null);
  const [pickerValue, setPickerValue] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [providers, setProviders] = useState([]);
  const [selectedProviderKey, setSelectedProviderKey] = useState(null);
  const [providerDropdownVisible, setProviderDropdownVisible] = useState(false);
  const [providerReloadToken, setProviderReloadToken] = useState(0);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(() => (isDateObject(today) ? cloneDate(today) : today));
  const [tempDate, setTempDate] = useState(() => (isDateObject(today) ? cloneDate(today) : today));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateError, setDateError] = useState('');
  const [confirmedDate, setConfirmedDate] = useState(null);
  const [slotsRequested, setSlotsRequested] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slotOptions, setSlotOptions] = useState([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [slotsRequestToken, setSlotsRequestToken] = useState(0);

  const geocodeCacheRef = useRef(new Map());
  const providersLocationRef = useRef('');

  const resetSlotsState = useCallback(() => {
    setSlotOptions([]);
    setSelectedSlotKey('');
    setSlotsError('');
    setSlotsLoading(false);
  }, []);

  const applyDateSelection = useCallback(
    pickedDate => {
      if (!isDateObject(pickedDate)) {
        return;
      }

      const normalized = startOfDay(pickedDate);
      const candidate = isDateObject(normalized) ? normalized : cloneDate(pickedDate);
      if (!isDateObject(candidate)) {
        return;
      }

      const todayDate = isDateObject(today) ? today : null;
      const safeBase = todayDate && candidate < todayDate ? todayDate : candidate;
      const safeDate = cloneDate(safeBase) || safeBase;

      if (!isDateObject(safeDate)) {
        return;
      }

      setSelectedDate(cloneDate(safeDate) || safeDate);
      setTempDate(cloneDate(safeDate) || safeDate);
      setDateError('');
    },
    [today],
  );

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
    setLoading(true);
    setError(null);
    geocodeCacheRef.current.clear();
    try {
      const patientKey = await AsyncStorage.getItem('patientKey');
      if (!patientKey) {
        throw new Error(
          t('booking.patient_key_missing', 'We could not find your patient information. Please complete registration first.'),
        );
      }

      const profile = await getPatientProfile(patientKey);
      const patientZip = normalizePostalCode(profile?.Zip);

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

      const rawLocations = await fetchPracticeLocations();
      const eligible = rawLocations.filter(loc => getExternalKey(loc) > 0);
      if (!eligible.length) {
        throw new Error(t('booking.no_locations_available', 'No eligible locations were found.'));
      }

      const enriched = [];
      for (const loc of eligible) {
        const rawKey =
          loc?.LocationKey ??
          loc?.locationKey ??
          loc?.Key ??
          loc?.LocationID ??
          loc?.LocationId ??
          loc?.Id ??
          loc?.id ??
          '';
        const locationKeyParam = toKeyString(rawKey);
        const locationData = {
          key:
            locationKeyParam ||
            sanitize(loc?.LocationDescription) ||
            sanitize(loc?.LocationName) ||
            Math.random().toString(36).slice(2),
          apiKey: locationKeyParam,
          label:
            sanitize(loc?.LocationDescription) ||
            sanitize(loc?.LocationName) ||
            sanitize(loc?.Description) ||
            t('booking.unnamed_location', 'Clinic location'),
          address1: sanitize(loc?.Address1 || loc?.address1),
          address2: sanitize(loc?.Address2 || loc?.address2),
          city: sanitize(loc?.City || loc?.city),
          state: sanitize(loc?.State || loc?.state),
          zip: sanitize(loc?.Zip || loc?.zip),
          externalKey: getExternalKey(loc),
          distanceKm: null,
          distanceMiles: null,
        };

        const normalizedZip = normalizePostalCode(locationData.zip);

        const addressVariants = [
          [locationData.address1, locationData.address2, locationData.city, locationData.state, normalizedZip],
          [locationData.address1, locationData.city, locationData.state, normalizedZip],
          [locationData.address1, locationData.city, locationData.state],
          [locationData.city, locationData.state],
        ];

        locationData.addressVariants = addressVariants;

        enriched.push(locationData);
      }

      const fullDestinationAddresses = enriched.map(buildFullAddress);
      let matrixDistances = [];
      try {
        matrixDistances = await getDrivingDistancesMiles(fullPatientAddress, fullDestinationAddresses);
      } catch (matrixError) {
        console.warn('[locations] distance matrix lookup failed', matrixError);
      }

      const needsFallback = [];
      enriched.forEach((locationData, index) => {
        const matrixEntry = Array.isArray(matrixDistances) ? matrixDistances[index] : null;
        if (matrixEntry && typeof matrixEntry.miles === 'number') {
          locationData.distanceMiles = matrixEntry.miles;
          locationData.distanceKm = typeof matrixEntry.kilometers === 'number' ? matrixEntry.kilometers : null;
        } else {
          needsFallback.push(locationData);
        }
      });

      if (needsFallback.length) {
        let cachedPatientCoords = null;
        try {
          cachedPatientCoords = await geocodeWithCache(fullPatientAddress);
        } catch (err) {
          console.warn('[locations] unable to geocode patient address for fallback distances', err);
        }

        if (cachedPatientCoords) {
          for (const locationData of needsFallback) {
            for (const parts of locationData.addressVariants || []) {
              const formatted = parts.filter(Boolean).join(', ');
              if (!formatted) continue;

              try {
                const coords = await geocodeWithCache(formatted);
                const km = distanceKm(
                  cachedPatientCoords.lat,
                  cachedPatientCoords.lon,
                  coords.lat,
                  coords.lon,
                );
                locationData.distanceKm = km;
                locationData.distanceMiles = distanceMiles(km);
                break;
              } catch (err) {
                // Try the next variant.
              }
            }

            if (locationData.distanceKm == null) {
              console.warn(
                '[locations] geocoding fallback failed for',
                locationData.key,
                'after trying address variants',
              );
            }
          }
        }
      }

      enriched.forEach(loc => {
        if (loc.addressVariants) {
          delete loc.addressVariants;
        }
      });

      enriched.sort((a, b) => {
        const da = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
        const db = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.label.localeCompare(b.label);
      });

      const nearest = enriched.slice(0, 3);
      const remaining = enriched.slice(3);

      setTopLocations(nearest);
      setOtherLocations(remaining);
      setPickerValue('');
      const initial = nearest[0] ?? remaining[0] ?? null;
      setSelectedLocationKey(initial ? initial.key : null);
    } catch (err) {
      console.error('[AppointmentBooking] loadLocations failed:', err);
      setError(err?.message || t('booking.locations_error', 'Unable to load locations at this time.'));
      setTopLocations([]);
      setOtherLocations([]);
      setSelectedLocationKey(null);
      setPickerValue('');
      setPatientAddress('');
    } finally {
      setLoading(false);
    }
  }, [geocodeWithCache, t]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    let isCancelled = false;
    const locationKey = sanitize(toKeyString(selectedLocationKey));
    const locationChanged = locationKey !== providersLocationRef.current;
    console.log('[booking] selected location key', locationKey);
    if (locationChanged) {
      setProviders([]);
      setSelectedProviderKey(null);
      setProviderDropdownVisible(false);
      resetSlotsState();
    }

    setProviderError('');

    if (!locationKey) {
      setProvidersLoading(false);
      if (locationChanged) {
        providersLocationRef.current = '';
      }
      setProviderDropdownVisible(false);
      resetSlotsState();
      return () => {
        isCancelled = true;
      };
    }

    setProvidersLoading(true);

    (async () => {
      try {
        console.log('[booking] loading providers for location', locationKey || '(none)');
        const rawProviders = await fetchProvidersForLocation(locationKey);
        if (isCancelled) return;

        console.log('[booking] providers raw count', Array.isArray(rawProviders) ? rawProviders.length : 0);

        const mapped = rawProviders
          .map((provider, index) => {
            const internalKey = resolveInternalProviderKey(provider);
            const externalId = resolveExternalProviderId(provider);

            const nameFallback =
              sanitize(provider?.ProviderName) ||
              sanitize(provider?.ProviderFullName) ||
              sanitize(provider?.FullName) ||
              sanitize(provider?.Name) ||
              sanitize(provider?.DisplayName);

            const key =
              internalKey ||
              externalId ||
              toKeyString(nameFallback) ||
              `provider-${index + 1}`;
            if (!key) {
              console.warn(`[booking] Provider ${index} has no key - skipping`);
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

            let displayName =
              baseName ||
              fallbackName ||
              nameFallback ||
              `${t('booking.provider_name_fallback', 'Provider')} ${index + 1}`;

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

            // Build provider address
            const addressParts = [
              sanitize(provider?.Address1),
              sanitize(provider?.City),
              sanitize(provider?.State),
              sanitize(provider?.Zip),
            ].filter(Boolean);
            const address = addressParts.length > 0 ? addressParts.join(', ') : null;

            return {
              key,
              apiKey: internalKey || key,
              internalProviderKey: internalKey || key,
              providerKey: internalKey || key,
              externalId,
              name: displayName,
              detail,
              address,
              raw: provider,
            };
          })
          .filter(item => item && item.key && item.name);

        console.log('[booking] providers mapped count', mapped.length);

        if (!mapped.length) {
          setProviders([]);
          setSelectedProviderKey(null);
          setProviderDropdownVisible(false);
          resetSlotsState();
          providersLocationRef.current = locationKey;
          return;
        }

        setProviders(mapped);
        console.log('[booking] providers set in state', mapped.length);

        const previousSelection = locationChanged ? null : selectedProviderKey;
        const nextSelection =
          mapped.find(provider => provider.key === previousSelection)?.key ??
          mapped.find(provider => provider.externalId)?.key ??
          mapped[0].key;
        setSelectedProviderKey(nextSelection);
        setProviderDropdownVisible(false);
        providersLocationRef.current = locationKey;
      } catch (err) {
        if (isCancelled) return;
        setProviders([]);
        setSelectedProviderKey(null);
        setProviderDropdownVisible(false);
        resetSlotsState();
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
  }, [selectedLocationKey, providerReloadToken, t, resetSlotsState]);

  useEffect(() => {
    let isCancelled = false;

    if (!slotsRequested || !confirmedDate) {
      if (!slotsRequested) {
        resetSlotsState();
      }
      return () => {
        isCancelled = true;
      };
    }

    if (!selectedLocation || !selectedProvider) {
      setSlotsLoading(false);
      setSlotsError('');
      if (!selectedProvider) {
        setSlotOptions([]);
        setSelectedSlotKey('');
      }
      return () => {
        isCancelled = true;
      };
    }

    const locationKeyParam = toKeyString(
      selectedLocation.apiKey || selectedLocation.externalKey || selectedLocation.key,
    );
    if (!locationKeyParam) {
      setSlotsLoading(false);
      setSlotOptions([]);
      setSelectedSlotKey('');
      setSlotsError(
        t(
          'booking.slots_missing_keys',
          'We could not determine the identifiers needed to load time slots for this selection.',
        ),
      );
      return () => {
        isCancelled = true;
      };
    }

    const providerExternalId = toKeyString(selectedProvider.externalId);
    if (!providerExternalId) {
      setSlotsLoading(false);
      setSlotOptions([]);
      setSelectedSlotKey('');
      setSlotsError(
        t(
          'booking.provider_missing_external_id',
          'The selected provider is missing the external ID required to load time slots. Please choose another provider.',
        ),
      );
      return () => {
        isCancelled = true;
      };
    }

    setSlotsLoading(true);
    setSlotsError('');

    (async () => {
      try {
        const rawSlots = await fetchAvailableSlots({
          locationKey: locationKeyParam,
          providerKey: providerExternalId,
          fromDate: confirmedDate,
          toDate: confirmedDate,
        });
        if (isCancelled) return;

        console.log('[booking] slots raw', rawSlots);

        const normalized = normalizeSlotOptions(rawSlots, confirmedDate);
        setSlotOptions(normalized);
        setSelectedSlotKey(prev => {
          if (prev && normalized.some(slot => slot.key === prev)) {
            return prev;
          }
          return normalized[0]?.key || '';
        });
      } catch (err) {
        if (isCancelled) return;
        setSlotOptions([]);
        setSelectedSlotKey('');
        setSlotsError(err?.message || t('booking.slots_error', 'Unable to load time slots right now.'));
      } finally {
        if (!isCancelled) {
          setSlotsLoading(false);
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
    selectedLocation,
    selectedProvider,
    t,
    resetSlotsState,
  ]);

  const allLocations = useMemo(() => [...topLocations, ...otherLocations], [topLocations, otherLocations]);
  const selectedLocation = useMemo(
    () => allLocations.find(loc => loc.key === selectedLocationKey) || null,
    [allLocations, selectedLocationKey],
  );
  const selectedProvider = useMemo(
    () => providers.find(provider => provider.key === selectedProviderKey) || null,
    [providers, selectedProviderKey],
  );
  const selectedSlot = useMemo(
    () => slotOptions.find(slot => slot.key === selectedSlotKey) || null,
    [slotOptions, selectedSlotKey],
  );

  const selectedDateLabel = useMemo(
    () =>
      selectedDate
        ? formatDateDisplay(selectedDate)
        : t('booking.select_date_placeholder', 'Select appointment date'),
    [selectedDate, t],
  );

  const confirmedDateLabel = useMemo(() => formatDateDisplay(confirmedDate), [confirmedDate]);

  const handleOpenDatePicker = useCallback(() => {
    const minimumDateBase = startOfDay(today || new Date());
    const minimumDate = isDateObject(minimumDateBase) ? minimumDateBase : startOfDay(new Date());

    const fallbackSource = selectedDate || minimumDate;
    const normalizedFallback = startOfDay(fallbackSource) || minimumDate;
    const clampedFallback =
      isDateObject(normalizedFallback) && normalizedFallback < minimumDate
        ? minimumDate
        : normalizedFallback;

    setTempDate(isDateObject(clampedFallback) ? cloneDate(clampedFallback) || clampedFallback : minimumDate);
    setShowDatePicker(true);
  }, [selectedDate, today]);

  const handlePickerCancel = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const handlePickerConfirm = useCallback(
    nextDate => {
      const normalized = startOfDay(nextDate) || nextDate;
      if (isDateObject(normalized)) {
        applyDateSelection(cloneDate(normalized) || normalized);
        setTempDate(normalized);
      }
      setShowDatePicker(false);
    },
    [applyDateSelection],
  );

  const pickerMinimumDate = useMemo(() => {
    const base = startOfDay(today || new Date());
    return isDateObject(base) ? base : startOfDay(new Date());
  }, [today]);

  const handleConfirmDate = useCallback(() => {
    const normalizedDate = startOfDay(selectedDate || today || new Date());

    if (!normalizedDate) {
      setDateError(t('booking.date_required', 'Please choose a date before confirming.'));
      return;
    }

    if (isDateObject(today) && normalizedDate < today) {
      setDateError(t('booking.date_in_past_error', 'Please choose a date that is today or later.'));
      setSelectedDate(cloneDate(today) || today);
      setTempDate(cloneDate(today) || today);
      return;
    }

    const safeDate = cloneDate(normalizedDate) || normalizedDate;
    setSelectedDate(safeDate);
    setDateError('');
    setConfirmedDate(cloneDate(safeDate) || safeDate);
    setSlotsRequested(true);
    resetSlotsState();
    setSlotsRequestToken(prev => prev + 1);
  }, [selectedDate, today, t, resetSlotsState]);

  const handleRetrySlots = useCallback(() => {
    if (!selectedLocation || !selectedProvider || !confirmedDate) {
      return;
    }
    setSlotsError('');
    setSlotsRequestToken(prev => prev + 1);
  }, [selectedLocation, selectedProvider, confirmedDate]);

  const handleSelectTop = locationKey => {
    setSelectedLocationKey(locationKey);
    setPickerValue('');
    setSelectedProviderKey(null);
    setProviderDropdownVisible(false);
    resetSlotsState();
  };

  const handlePickerChange = value => {
    setPickerValue(value);
    if (value) {
      setSelectedLocationKey(value);
    }
    setSelectedProviderKey(null);
    setProviderDropdownVisible(false);
    resetSlotsState();
  };

  const handleRetryProviders = useCallback(() => {
    setProviderReloadToken(prev => prev + 1);
  }, []);

  const handleProviderSelect = useCallback(
    value => {
      const normalized = value || null;
      setProviderDropdownVisible(false);
      setSelectedProviderKey(normalized);
      resetSlotsState();
    },
    [resetSlotsState],
  );

  const renderLocationCard = loc => {
    const distance = typeof loc.distanceMiles === 'number' ? loc.distanceMiles : null;
    const address = formatAddress(loc);
    const isSelected = selectedLocationKey === loc.key;
    return (
      <TouchableOpacity
        key={loc.key || loc.label}
        style={[styles.locationCard, isSelected && styles.locationCardSelected]}
        onPress={() => handleSelectTop(loc.key)}
        activeOpacity={0.85}
      >
        <View style={styles.locationHeader}>
          <Text style={styles.locationName}>{loc.label}</Text>
          {distance != null && (
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>{`${distance.toFixed(1)} mi`}</Text>
            </View>
          )}
        </View>
        {address ? <Text style={styles.locationAddress}>{address}</Text> : null}
        {distance != null ? (
          <Text style={styles.locationDistance}>
            {t('booking.approx_distance', 'Approx. {{miles}} miles away', {
              miles: distance.toFixed(1),
            })}
          </Text>
        ) : (
          <Text style={styles.locationDistanceUnavailable}>
            {t('booking.distance_unavailable', 'Distance unavailable')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const formatPickerLabel = loc => {
    if (typeof loc.distanceMiles === 'number') {
      return `${loc.label} (${loc.distanceMiles.toFixed(1)} ${t('booking.miles_suffix', 'mi away')})`;
    }
    return `${loc.label} (${t('booking.distance_unavailable_short', 'distance unavailable')})`;
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <Text style={styles.heading}>{t('booking.choose_location', 'Choose a location')}</Text>
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
            <Ionicons name="calendar-outline" size={20} color="#2A7D8F" style={styles.datePickerIcon} />
            <Text style={styles.datePickerButtonText}>{selectedDateLabel}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.dateConfirmButton}
          onPress={handleConfirmDate}
          activeOpacity={0.85}
        >
          <Text style={styles.dateConfirmButtonText}>{t('booking.confirm_date', 'Confirm date')}</Text>
        </TouchableOpacity>
        {dateError ? <Text style={styles.dateErrorText}>{dateError}</Text> : null}
        {slotsRequested && confirmedDate ? (
          <Text style={styles.dateStatusText}>
            {t('booking.showing_slots_for_date', 'Showing times for {{date}}', { date: confirmedDateLabel })}
          </Text>
        ) : (
          <Text style={styles.dateHintText}>
            {t('booking.date_picker_hint', 'Pick a date and confirm to see available times.')}
          </Text>
        )}
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2A7D8F" />
          <Text style={styles.loadingText}>{t('booking.loading_locations', 'Finding nearby locations...')}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLocations}>
            <Text style={styles.retryText}>{t('booking.retry', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {patientAddress ? (
            <View style={styles.patientCard}>
              <Text style={styles.patientLabel}>{t('booking.patient_location', 'Your address')}</Text>
              <Text style={styles.patientAddress}>{patientAddress}</Text>
              <Text style={styles.patientDistanceHint}>
                {t(
                  'booking.distance_hint',
                  'Distances below are calculated from your registration address using Google Maps.',
                )}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t('booking.nearest_locations', 'Top locations near you')}</Text>
          {topLocations.length ? (
            topLocations.map(renderLocationCard)
          ) : (
            <Text style={styles.emptyText}>{t('booking.no_nearby_locations', 'No nearby locations available.')}</Text>
          )}

          {otherLocations.length > 0 && (
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>{t('booking.other_locations', 'Other locations')}</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={pickerValue}
                  onValueChange={handlePickerChange}
                  style={styles.picker}
                  dropdownIconColor="#2A7D8F"
                >
                  <Picker.Item
                    label={t('booking.select_other_location', 'Select another location')}
                    value=""
                  />
                  {otherLocations.map(loc => (
                    <Picker.Item
                      key={loc.key}
                      label={formatPickerLabel(loc)}
                      value={loc.key}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          {selectedLocation ? (
            <View style={styles.providerSection}>
              <Text style={styles.sectionTitle}>{t('booking.choose_provider', 'Choose a provider')}</Text>
              {providersLoading ? (
                <View style={styles.providerLoadingRow}>
                  <ActivityIndicator size="small" color="#2A7D8F" />
                  <Text style={styles.providerLoadingText}>
                    {t('booking.loading_providers', 'Loading providers for this location...')}
                  </Text>
                </View>
              ) : providerError ? (
                <View style={styles.providerErrorContainer}>
                  <Text style={styles.providerErrorText}>{providerError}</Text>
                  <TouchableOpacity style={styles.providerRetryButton} onPress={handleRetryProviders}>
                    <Text style={styles.providerRetryText}>{t('booking.retry', 'Try again')}</Text>
                  </TouchableOpacity>
                </View>
              ) : providers.length ? (
                <View style={styles.providerPickerSection}>
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
                  {selectedProvider?.detail ? (
                    <Text style={styles.providerDetailSelected}>{selectedProvider.detail}</Text>
                  ) : !selectedProvider ? (
                    <Text style={styles.providerPrompt}>
                      {t('booking.select_provider_prompt', 'Select a provider to continue.')}
                    </Text>
                  ) : null}
                  {selectedProvider?.address ? (
                    <Text style={styles.providerAddressSelected}>{selectedProvider.address}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.providerEmptyText}>
                  {t('booking.no_providers_for_location', 'No providers are available for this location.')}
                </Text>
              )}
            </View>
          ) : null}

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
                    onPress={() => handleProviderSelect('')}
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
                        onPress={() => handleProviderSelect(provider.key)}
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
                        {provider.address ? (
                          <Text style={styles.providerDropdownOptionAddress}>{provider.address}</Text>
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

          <View style={styles.slotSection}>
            <Text style={styles.sectionTitle}>{t('booking.available_slots', 'Available time slots')}</Text>
            {!slotsRequested ? (
              <Text style={styles.slotInfoText}>
                {t('booking.confirm_date_for_slots', 'Confirm a date to view available time slots.')}
              </Text>
            ) : !selectedLocation || !selectedProvider ? (
              <Text style={styles.slotInfoText}>
                {t('booking.slots_select_location_provider', 'Select a location and provider to view available times.')}
              </Text>
            ) : slotsLoading ? (
              <View style={styles.slotLoadingRow}>
                <ActivityIndicator size="small" color="#2A7D8F" />
                <Text style={styles.slotLoadingText}>
                  {t('booking.loading_slots', 'Loading available time slots...')}
                </Text>
              </View>
            ) : slotsError ? (
              <View style={styles.slotErrorContainer}>
                <Text style={styles.slotErrorText}>{slotsError}</Text>
                <TouchableOpacity style={styles.slotRetryButton} onPress={handleRetrySlots}>
                  <Text style={styles.slotRetryText}>{t('booking.retry', 'Try again')}</Text>
                </TouchableOpacity>
              </View>
            ) : slotOptions.length ? (
              <View style={styles.slotList}>
                {slotOptions.map(slot => {
                  const label = slot.label || t('booking.slot_time_unavailable', 'Time unavailable');
                  const isSelected = selectedSlotKey === slot.key;
                  return (
                    <TouchableOpacity
                      key={slot.key}
                      style={[styles.slotButton, isSelected && styles.slotButtonSelected]}
                      onPress={() => setSelectedSlotKey(slot.key)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.slotButtonText, isSelected && styles.slotButtonTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.slotInfoText}>
                {t('booking.no_slots_for_date', 'No time slots are available for the selected date.')}
              </Text>
            )}
          </View>

          {selectedLocation ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="location-outline" size={22} color="#2A7D8F" />
                <Text style={styles.summaryTitle}>{t('booking.selected_location', 'Selected location')}</Text>
              </View>
              <Text style={styles.summaryName}>{selectedLocation.label}</Text>
              <Text style={styles.summaryText}>{formatAddress(selectedLocation)}</Text>
              {typeof selectedLocation.distanceMiles === 'number' ? (
                <Text style={styles.summaryDistance}>
                  {t('booking.distance_from_you', 'Approx. {{miles}} miles away', {
                    miles: selectedLocation.distanceMiles.toFixed(1),
                  })}
                </Text>
              ) : (
                <Text style={styles.summaryDistanceUnavailable}>
                  {t('booking.distance_unavailable', 'Distance unavailable')}
                </Text>
              )}

              {selectedProvider ? (
                <View style={styles.summaryProvider}>
                  <Text style={styles.summarySubheading}>{t('booking.selected_provider', 'Selected provider')}</Text>
                  <Text style={styles.summaryProviderName}>{selectedProvider.name}</Text>
                  {selectedProvider.detail ? (
                    <Text style={styles.summaryProviderDetail}>{selectedProvider.detail}</Text>
                  ) : null}
                  {selectedProvider.address ? (
                    <Text style={styles.summaryProviderAddress}>{selectedProvider.address}</Text>
                  ) : null}
                </View>
              ) : providersLoading ? null : providers.length ? (
                <Text style={styles.summaryProviderPending}>
                  {t('booking.select_provider_prompt', 'Select a provider to continue.')}
                </Text>
              ) : (
                <Text style={styles.summaryProviderUnavailable}>
                  {t('booking.providers_unavailable', 'Provider selection is unavailable for this location.')}
                </Text>
              )}

              <View style={styles.summaryDivider} />

              {confirmedDate ? (
                <View style={styles.summaryDateSection}>
                  <Text style={styles.summarySubheading}>{t('booking.selected_date', 'Selected date')}</Text>
                  <Text style={styles.summaryDateText}>{confirmedDateLabel}</Text>
                </View>
              ) : (
                <Text style={styles.summaryDatePending}>
                  {t('booking.select_date_prompt', 'Confirm a date to continue.')}
                </Text>
              )}

              {slotsError && slotsRequested && selectedProvider ? (
                <Text style={styles.summarySlotError}>{slotsError}</Text>
              ) : selectedSlot ? (
                <View style={styles.summarySlotSection}>
                  <Text style={styles.summarySubheading}>{t('booking.selected_time', 'Selected time slot')}</Text>
                  <Text style={styles.summarySlotText}>
                    {selectedSlot.label || t('booking.slot_time_unavailable', 'Time unavailable')}
                  </Text>
                </View>
              ) : slotsLoading ? null : slotsRequested && confirmedDate ? (
                slotOptions.length ? (
                  <Text style={styles.summarySlotPending}>
                    {t('booking.select_slot_prompt', 'Select a time slot to continue.')}
                  </Text>
                ) : (
                  <Text style={styles.summarySlotUnavailable}>
                    {t('booking.no_slots_for_date', 'No time slots are available for the selected date.')}
                  </Text>
                )
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      <SimpleDatePickerModal
        visible={showDatePicker}
        initialDate={tempDate || pickerMinimumDate || today || new Date()}
        minimumDate={pickerMinimumDate || startOfDay(new Date())}
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
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 22,
    color: '#2A7D8F',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
    fontWeight: '700',
  },
  dateSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F5FBFD',
    borderWidth: 1,
    borderColor: '#C9E3EA',
  },
  dateSectionTitle: {
    fontSize: 16,
    color: '#1B3A4B',
    fontWeight: '600',
    marginBottom: 12,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A7D8F',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  datePickerButtonFirst: {
    marginRight: 12,
  },
  datePickerIcon: {
    marginRight: 8,
  },
  datePickerButtonText: {
    color: '#1B3A4B',
    fontSize: 16,
    fontWeight: '600',
  },
  dateConfirmButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#2A7D8F',
    paddingVertical: 12,
  },
  dateConfirmButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  dateErrorText: {
    marginTop: 10,
    color: '#C62828',
    textAlign: 'center',
  },
  dateHintText: {
    marginTop: 12,
    color: '#4A6C82',
    textAlign: 'center',
    fontSize: 13,
  },
  dateStatusText: {
    marginTop: 12,
    color: '#2A7D8F',
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#4A6C82',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 18,
  },
  retryButton: {
    backgroundColor: '#2A7D8F',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  patientCard: {
    backgroundColor: '#E4F3F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  patientLabel: {
    color: '#2A7D8F',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  patientAddress: {
    color: '#1B3A4B',
    fontSize: 16,
    lineHeight: 22,
  },
  patientDistanceHint: {
    marginTop: 10,
    color: '#4A6C82',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1B3A4B',
    fontWeight: '600',
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: '#F5FBFD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  locationCardSelected: {
    borderColor: '#2A7D8F',
    backgroundColor: '#DDF1F6',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationName: {
    fontSize: 16,
    color: '#1B3A4B',
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  distanceBadge: {
    backgroundColor: '#2A7D8F',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distanceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  locationAddress: {
    marginTop: 8,
    color: '#34515E',
    lineHeight: 20,
  },
  locationDistance: {
    marginTop: 8,
    color: '#2A7D8F',
    fontWeight: '600',
  },
  locationDistanceUnavailable: {
    marginTop: 8,
    color: '#A0AEB4',
    fontStyle: 'italic',
  },
  dropdownContainer: {
    marginTop: 20,
  },
  dropdownLabel: {
    fontSize: 16,
    color: '#1B3A4B',
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#C9E3EA',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F5FBFD',
  },
  picker: {
    height: 48,
  },
  providerSection: {
    marginTop: 28,
  },
  providerLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  providerLoadingText: {
    marginLeft: 10,
    color: '#4A6C82',
  },
  providerErrorContainer: {
    backgroundColor: '#FDECEA',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerErrorText: {
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 12,
  },
  providerRetryButton: {
    backgroundColor: '#2A7D8F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  providerRetryText: {
    color: '#fff',
    fontWeight: '600',
  },
  providerEmptyText: {
    color: '#4A6C82',
    fontStyle: 'italic',
  },
  providerPickerSection: {
    marginTop: 8,
  },
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
  providerDropdownOptionAddress: {
    marginTop: 3,
    color: '#6B7D87',
    fontSize: 12,
    fontStyle: 'italic',
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
  providerDetailSelected: {
    marginTop: 12,
    color: '#4A6C82',
  },
  providerAddressSelected: {
    marginTop: 8,
    color: '#6B7D87',
    fontSize: 12,
    fontStyle: 'italic',
  },
  slotSection: {
    marginTop: 28,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F5FBFD',
    borderWidth: 1,
    borderColor: '#C9E3EA',
  },
  slotInfoText: {
    color: '#4A6C82',
    fontStyle: 'italic',
  },
  slotLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  slotLoadingText: {
    marginLeft: 10,
    color: '#4A6C82',
  },
  slotErrorContainer: {
    backgroundColor: '#FDECEA',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  slotErrorText: {
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 12,
  },
  slotRetryButton: {
    backgroundColor: '#2A7D8F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  slotRetryText: {
    color: '#fff',
    fontWeight: '600',
  },
  slotList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  slotButton: {
    borderWidth: 1,
    borderColor: '#2A7D8F',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  slotButtonSelected: {
    backgroundColor: '#2A7D8F',
  },
  slotButtonText: {
    color: '#1B3A4B',
    fontWeight: '600',
  },
  slotButtonTextSelected: {
    color: '#fff',
  },
  summaryCard: {
    marginTop: 28,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#EEF7F9',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    color: '#1B3A4B',
    fontWeight: '600',
    marginLeft: 8,
  },
  summaryName: {
    fontSize: 18,
    color: '#1B3A4B',
    fontWeight: '700',
    marginBottom: 6,
  },
  summaryText: {
    color: '#34515E',
    lineHeight: 20,
  },
  summaryDistance: {
    marginTop: 10,
    color: '#2A7D8F',
    fontWeight: '600',
  },
  summaryDistanceUnavailable: {
    marginTop: 10,
    color: '#A0AEB4',
    fontStyle: 'italic',
  },
  summaryProvider: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#C9E3EA',
  },
  summarySubheading: {
    fontSize: 14,
    color: '#2A7D8F',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryProviderName: {
    fontSize: 16,
    color: '#1B3A4B',
    fontWeight: '600',
  },
  summaryProviderDetail: {
    marginTop: 4,
    color: '#4A6C82',
  },
  summaryProviderAddress: {
    marginTop: 6,
    color: '#6B7D87',
    fontSize: 12,
    fontStyle: 'italic',
  },
  summaryProviderPending: {
    marginTop: 16,
    color: '#4A6C82',
    fontStyle: 'italic',
  },
  summaryProviderUnavailable: {
    marginTop: 16,
    color: '#A0AEB4',
    fontStyle: 'italic',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#C9E3EA',
    marginVertical: 16,
  },
  summaryDateSection: {
    marginTop: 0,
  },
  summaryDateText: {
    fontSize: 16,
    color: '#1B3A4B',
    fontWeight: '600',
  },
  summaryDatePending: {
    color: '#4A6C82',
    fontStyle: 'italic',
  },
  summarySlotSection: {
    marginTop: 12,
  },
  summarySlotText: {
    marginTop: 4,
    color: '#1B3A4B',
    fontWeight: '600',
  },
  summarySlotPending: {
    marginTop: 12,
    color: '#4A6C82',
    fontStyle: 'italic',
  },
  summarySlotUnavailable: {
    marginTop: 12,
    color: '#A0AEB4',
    fontStyle: 'italic',
  },
  summarySlotError: {
    marginTop: 12,
    color: '#C62828',
  },
  emptyText: {
    color: '#4A6C82',
    fontStyle: 'italic',
    marginBottom: 16,
  },
});
