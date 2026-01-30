// frontend/screens/ConfirmAppointmentScreen.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { bookAppointmentTransaction } from '../services/BookingService';
import { addNotification } from '../services/notificationService.js';
import { setProgress as setLocalProgress } from '../services/localProgress';
import * as Notifications from 'expo-notifications';
import { DEFAULT_FREQUENCIES, frequencyToMs } from '../services/reminderSettings';
import { setReminder } from '../services/appointmentReminders';

const sanitize = value => (typeof value === 'string' ? value.trim() : '');

const isDateObject = value => (
  !!value && typeof value.getTime === 'function' && !Number.isNaN(value.getTime())
);

const normalizeToDate = value => {
  if (isDateObject(value)) {
    return new Date(value.getTime());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const [, yearStr, monthStr, dayStr] = ymdMatch;
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day)
      ) {
        const candidate = new Date(year, month - 1, day);
        if (!Number.isNaN(candidate.getTime())) {
          return candidate;
        }
      }
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
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

const formatDisplayDate = value => {
  const date = normalizeToDate(value);
  if (!date) return '';
  try {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return date.toDateString();
  }
};

const formatDisplayDay = value => {
  const date = normalizeToDate(value);
  if (!date) return '';
  try {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return '';
  }
};

const formatDisplayTime = (explicitTime, fallbackDate) => {
  const candidate = sanitize(explicitTime);
  if (candidate) {
    return candidate;
  }
  const date = normalizeToDate(fallbackDate);
  if (!date) return '—';
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }
};

export default function ConfirmAppointmentScreen({ navigation, route }) {
  const { t } = useTranslation();
  const {
    location            = {},
    provider            = {},
    date                = null,
    dateLabel           = null,
    time                = null,
    appointmentDateTime = null,
    patientKey          = null,
    patientName         = null,
    slot                = null,
  } = route.params || {};

  const [name, setName] = useState(patientName);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!name && patientKey) {
      AsyncStorage.getItem('patientName')
        .then(stored => {
          if (stored) setName(stored);
        })
        .catch(() => {});
    }
  }, [name, patientKey]);

  const slotBookingDateTime = slot?.bookingDateTime;
  const derivedAppointmentDate = useMemo(() => {
    return (
      parseAppointmentDateTime(appointmentDateTime) ||
      parseAppointmentDateTime(slotBookingDateTime) ||
      normalizeToDate(date) ||
      normalizeToDate(dateLabel)
    );
  }, [appointmentDateTime, slotBookingDateTime, date, dateLabel]);

  const formattedDate = useMemo(() => {
    if (dateLabel) {
      const normalized = formatDisplayDate(dateLabel);
      if (normalized) {
        return normalized;
      }
    }
    if (derivedAppointmentDate) {
      return formatDisplayDate(derivedAppointmentDate);
    }
    if (date) {
      const normalized = formatDisplayDate(date);
      if (normalized) {
        return normalized;
      }
    }
    return '—';
  }, [dateLabel, derivedAppointmentDate, date]);

  const formattedDay = useMemo(() => {
    if (derivedAppointmentDate) {
      return formatDisplayDay(derivedAppointmentDate);
    }
    if (date) {
      return formatDisplayDay(date);
    }
    return '';
  }, [derivedAppointmentDate, date]);

  const formattedTime = useMemo(() => {
    return formatDisplayTime(time || slot?.timeLabel || slot?.start, derivedAppointmentDate);
  }, [time, slot, derivedAppointmentDate]);

  const dayTimeLabel = useMemo(() => {
    if (formattedDay) {
      return `${formattedDay}, ${formattedTime}`;
    }
    return formattedTime;
  }, [formattedDay, formattedTime]);

  const normalizeKey = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    return sanitize(value);
  };

  const getAppointmentDateTime = () => {
    if (appointmentDateTime) {
      return appointmentDateTime;
    }
    if (slotBookingDateTime) {
      return slotBookingDateTime;
    }
    if (!derivedAppointmentDate) {
      return '';
    }
    const dt = derivedAppointmentDate;
    const YYYY = dt.getFullYear();
    const MM = String(dt.getMonth() + 1).padStart(2, '0');
    const DD = String(dt.getDate()).padStart(2, '0');
    let hours = dt.getHours();
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hourStr = String(hours).padStart(2, '0');
    return `${YYYY}${MM}${DD}${hourStr}${minutes}${meridiem}`;
  };

  const handleConfirm = async () => {
    const locationPrimaryKey = normalizeKey(
      location?.primaryKey ?? location?.key ?? location?.locationKey
    );
    const providerKey = normalizeKey(provider?.primaryKey ?? provider?.key);
    const appointmentDateTimeValue = getAppointmentDateTime();

    // Extract external IPM keys
    const locationExternalKey = normalizeKey(
      location?.ExternalIPMKey ??
      location?.LocationExternalIPMKey ??
      location?.externalIPMKey ??
      location?.externalIpmKey ??
      location?.ExternalKey ??
      location?.externalKey
    );
    const providerExternalKey = normalizeKey(
      provider?.ExternalIPMKey ??
      provider?.ExternalProviderKey ??
      provider?.externalProviderKey ??
      provider?.ExternalKey ??
      provider?.externalKey ??
      provider?.externalIpmKey ??
      provider?.ipmKey
    );

    if (!patientKey || !locationPrimaryKey || !providerKey || !appointmentDateTimeValue) {
      return Alert.alert(t('error'), t('confirm_appt.missing_info'));
    }

    const AppointmentDateTime = appointmentDateTimeValue;
    const appointmentTimeLabel = (() => {
      const direct = sanitize(slot?.timeLabel) || sanitize(time);
      if (direct) {
        return direct;
      }
      const fallback = sanitize(formattedTime);
      return fallback === '—' ? '' : fallback;
    })();

    if (!appointmentTimeLabel) {
      return Alert.alert(t('error'), t('confirm_appt.missing_info'));
    }

    setLoading(true);
    try {
      // Get patient data from AsyncStorage for IPM booking
      const [regFirstName, regLastName, storedPatientName, storedPhone, storedDob] = await Promise.all([
        AsyncStorage.getItem('regFirstName').catch(() => ''),
        AsyncStorage.getItem('regLastName').catch(() => ''),
        AsyncStorage.getItem('patientName').catch(() => ''),
        AsyncStorage.getItem('patientPhone').catch(() => ''),
        AsyncStorage.getItem('patientDob').catch(() => ''),
      ]);

      const patientNameValue = sanitize(name) || sanitize(storedPatientName);
      const splitName = (fullName) => {
        const trimmed = sanitize(fullName);
        if (!trimmed) return { first: '', last: '' };
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (!parts.length) return { first: '', last: '' };
        const [first, ...rest] = parts;
        return { first: first || '', last: rest.join(' ') };
      };
      const derivedNameParts = splitName(patientNameValue);
      const firstName = sanitize(regFirstName) || derivedNameParts.first;
      const lastName = sanitize(regLastName) || derivedNameParts.last;

      // Format birthdate to MM/DD/YYYY
      const formatSlashDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
      };
      const birthDate = formatSlashDate(storedDob);

      // Extract digits only from phone
      const digitsOnly = (value) => (typeof value === 'string' ? value.replace(/\D+/g, '') : '');
      const phone = digitsOnly(storedPhone);

      console.log('[booking] confirm payload', {
        patientKey,
        providerKey,
        providerName: provider?.label || 'Provider',
        locationName: location?.label || 'Location',
        appointmentDateTimeValue,
        providerExternalKey,
        locationExternalKey,
      });
      const startDate =
        parseAppointmentDateTime(AppointmentDateTime) ||
        parseAppointmentDateTime(slotBookingDateTime) ||
        derivedAppointmentDate ||
        normalizeToDate(dateLabel) ||
        normalizeToDate(date);

      if (!startDate) {
        throw new Error('Missing appointment start time.');
      }

      const endDateCandidate = normalizeToDate(
        slot?.endDateTime ||
          slot?.EndDateTime ||
          slot?.end ||
          slot?.End ||
          null,
      );
      const endDate = endDateCandidate || new Date(startDate.getTime() + 30 * 60 * 1000);

      const booked = await bookAppointmentTransaction({
        patientKey,
        internalProviderKey: providerKey,
        providerName: provider?.label || 'Provider',
        locationName: location?.label || 'Location',
        address1: location?.address1 || '',
        address2: location?.address2 || '',
        city: location?.city || '',
        state: location?.state || '',
        zip: location?.zip || '',
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
        notes: '',
        // IPM booking parameters
        providerExternalKey,
        locationExternalKey,
        appointmentDateTime: AppointmentDateTime,
        appointmentTime: appointmentTimeLabel,
        firstName,
        lastName,
        birthDate,
        phone,
      });
      console.log('[booking] referral transaction complete', booked);
      try {
        await setLocalProgress(3);
      } catch {}

      // ─── push in-app notification ───────────────────────────
      await addNotification({
        dateGroupKey: 'notification.today',
        icon:         'calendar-outline',
        titleKey:     'notification.scheduled_appointment',
        textKey:      'notification.appointment_set',
        time:         'Now',
      });
      // Schedule out-of-app reminder using default frequency
      try {
        const appt = new Date(startDate.getTime());
        const [hhmm, ampm] = appointmentTimeLabel.split(' ');
        let [hh, mm] = hhmm.split(':').map(Number);
        if (ampm === 'PM' && hh < 12) hh += 12;
        if (ampm === 'AM' && hh === 12) hh = 0;
        appt.setHours(hh, mm, 0, 0);
        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted) {
          await Notifications.requestPermissionsAsync();
        }
        const body = t('notification.appointment_details', {
          time,
          date: formattedDate,
        });
        const notifIds = [];
        for (const freq of DEFAULT_FREQUENCIES) {
          const ms = frequencyToMs(freq);
          const when = new Date(appt.getTime() - ms);
          if (when > new Date()) {
            const id = await Notifications.scheduleNotificationAsync({
              content: {
                title: t('notification.scheduled_appointment'),
                body,
              },
              trigger: { type: 'date', date: when },
            });
            notifIds.push(id);
          }
        }
        const apptKey = booked?.referralKey ?? booked;
        if (apptKey) {
          await setReminder(String(apptKey), { settings: DEFAULT_FREQUENCIES, notifIds });
        }
      } catch {}
      // ────────────────────────────────────────────────────────

      await AsyncStorage.removeItem('initialConsultationDraft');
      navigation.navigate('Appointments', { patientKey });
    } catch (err) {
      Alert.alert(t('error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Nav Bar */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('confirm_appt.title')}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Patient Name */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('confirm_appt.patient_name')}</Text>
          <Text style={styles.cardValue}>{name || '—'}</Text>
        </View>

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('initial_consultation.location')}</Text>
          <Text style={styles.cardValue}>
            {location.label || '—'}
            {'\n'}
            {location.address1 || ''}
            {location.address2 ? ` • ${location.address2}` : ''}
            {'\n'}
            {location.city || ''}{location.state ? `, ${location.state}` : ''}
            {location.zip    ? ` • ${location.zip}` : ''}
          </Text>
        </View>

        {/* Provider */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('initial_consultation.provider')}</Text>
          <Text style={styles.cardValue}>{provider.label || '—'}</Text>
        </View>

        {/* Date & Time */}
        <View style={styles.dateRow}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{formattedDate}</Text>
          </View>
          <Text style={styles.dayTime}>{dayTimeLabel}</Text>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>{t('confirm_appt.confirm_button')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper:       { flex: 1, backgroundColor: '#fff' },
  container:     { padding: 20, paddingBottom: 40 },
  nav:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:         { fontSize: 20, color: '#2A7D8F', fontWeight: '600' },
  card:          { backgroundColor: '#AEDAE9', borderRadius: 20, padding: 16, marginBottom: 20 },
  cardLabel:     { color: '#2A7D8F', fontWeight: '600', marginBottom: 6 },
  cardValue:     { color: '#333', lineHeight: 20 },
  dateRow:       { marginBottom: 20 },
  dateBadge:     { backgroundColor: '#4A6C82', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  dateBadgeText: { color: '#fff', fontWeight: '600' },
  dayTime:       { color: '#666', marginTop: 8, fontSize: 16 },
  confirmBtn:    { backgroundColor: '#4A6C82', borderRadius: 25, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  confirmText:   { color: '#fff', fontSize: 16 },
});
