// frontend/screens/AppointmentsScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  SectionList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import WheelPickerExpo from 'react-native-wheel-picker-expo';

import { getMyAppointments } from '../services/AppointmentService';
import { getAllReminders, setReminder } from '../services/appointmentReminders';
import { frequencyToMs, DEFAULT_FREQUENCIES } from '../services/reminderSettings';

export default function AppointmentsScreen() {
  const { t } = useTranslation();
  const [appointmentSections, setAppointmentSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [reminders, setReminders] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalAppt, setModalAppt] = useState(null);
  const [tempFreqs, setTempFreqs] = useState([...DEFAULT_FREQUENCIES]);
  const [editingIndex, setEditingIndex] = useState(0);

  const formatFreq = f => {
    const parts = [];
    if (f.days) parts.push(`${f.days}d`);
    if (f.hours) parts.push(`${f.hours}h`);
    if (f.minutes) parts.push(`${f.minutes}m`);
    if (!parts.length) parts.push('0m');
    return parts.join(' ');
  };

  const normalize = value => (typeof value === 'string' ? value.trim() : '');

  const formatDisplayDate = date => {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatDisplayTime = date => {
    let hours = date.getHours();
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${meridiem}`;
  };

  const formatOrdinalDay = day => {
    const mod10 = day % 10;
    const mod100 = day % 100;
    if (mod10 === 1 && mod100 !== 11) return `${day}st`;
    if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
    if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
    return `${day}th`;
  };

  const formatFriendlyDate = value => {
    const date = parseDateTime(value);
    if (!date) return '';
    const monthLabel = date.toLocaleString('en-US', { month: 'short' });
    const dayLabel = formatOrdinalDay(date.getDate());
    const year = date.getFullYear();
    return `${monthLabel} ${dayLabel}, ${year}`;
  };

  const parseDateTime = value => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatIcsDate = date => {
    const iso = date.toISOString();
    return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };

  const sanitizeCalendarText = value =>
    String(value || '')
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const buildCalendarUrls = ({ title, location, details, start, end }) => {
    const startToken = formatIcsDate(start);
    const endToken = formatIcsDate(end);
    const googleUrl =
      `https://www.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${encodeURIComponent(`${startToken}/${endToken}`)}` +
      `&details=${encodeURIComponent(details)}` +
      `&location=${encodeURIComponent(location)}`;

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Case Management//Appointments//EN',
      'BEGIN:VEVENT',
      `DTSTART:${startToken}`,
      `DTEND:${endToken}`,
      `SUMMARY:${sanitizeCalendarText(title)}`,
      location ? `LOCATION:${sanitizeCalendarText(location)}` : null,
      details ? `DESCRIPTION:${sanitizeCalendarText(details)}` : null,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);
    const icsBody = icsLines.join('\r\n');
    const icsUrl = `data:text/calendar;charset=utf8,${encodeURIComponent(icsBody)}`;
    return { googleUrl, icsUrl };
  };

  const openCalendarPrompt = appointment => {
    const start = parseDateTime(appointment?.AppointmentStartDateTime);
    if (!start) return;
    const end =
      parseDateTime(appointment?.AppointmentEndDateTime) ||
      new Date(start.getTime() + 30 * 60 * 1000);
    const title = sanitizeCalendarText(appointment?.AppointmentProviderName || 'Appointment');
    const location = sanitizeCalendarText(appointment?.AppointmentLocation || '');
    const details = sanitizeCalendarText(appointment?.AppointmentNotes || '');
    const { googleUrl, icsUrl } = buildCalendarUrls({ title, location, details, start, end });

    Alert.alert(
      t('appointments.calendar_title', 'Add to calendar'),
      t('appointments.calendar_prompt', 'Choose a calendar app'),
      [
        {
          text: t('appointments.calendar_apple', 'Apple Calendar'),
          onPress: async () => {
            const supported = await Linking.canOpenURL(icsUrl);
            await Linking.openURL(supported ? icsUrl : googleUrl);
          },
        },
        {
          text: t('appointments.calendar_google', 'Google Calendar'),
          onPress: async () => {
            await Linking.openURL(googleUrl);
          },
        },
        { text: t('cancel', 'Cancel'), style: 'cancel' },
      ],
    );
  };

  const buildDisplayFields = schedule => {
    const startDate = parseDateTime(schedule?.startDateTime);
    const endDate = parseDateTime(schedule?.endDateTime);
    return {
      appointmentDate: startDate ? formatDisplayDate(startDate) : '',
      appointmentTime: startDate ? formatDisplayTime(startDate) : '',
      endTimeLabel: endDate ? formatDisplayTime(endDate) : '',
    };
  };

  const loadUpcoming = async () => {
    setRefreshing(true);
    try {
      const key = await AsyncStorage.getItem('patientKey');
      if (!key) throw new Error('No patient key stored');
      const groups = await getMyAppointments(Number(key));
      const mappedSections = groups.map(group => {
        const scheduleItems = group.schedules
          .map(schedule => {
            const display = buildDisplayFields(schedule);
            return {
              AppointmentKey: `${group.providerName}-${schedule.startDateTime}`,
              AppointmentDate: display.appointmentDate,
              AppointmentTime: display.appointmentTime,
              AppointmentEndTime: display.endTimeLabel,
              AppointmentStartDateTime: schedule.startDateTime,
              AppointmentEndDateTime: schedule.endDateTime,
              AppointmentStatus: schedule.status || t('appointments.status_scheduled', 'Scheduled'),
              AppointmentNotes: schedule.comments || '',
              AppointmentProviderName: group.providerName,
              AppointmentLocation: group.locationDetails,
              AppointmentIsPlaceholder: false,
            };
          })
          .sort((a, b) => {
            const aDate = parseDateTime(a.AppointmentStartDateTime);
            const bDate = parseDateTime(b.AppointmentStartDateTime);
            const aTime = aDate ? aDate.getTime() : Number.POSITIVE_INFINITY;
            const bTime = bDate ? bDate.getTime() : Number.POSITIVE_INFINITY;
            return aTime - bTime;
          });

        const data = scheduleItems.length
          ? scheduleItems
          : [
              {
                AppointmentKey: `${group.providerName}-empty`,
                AppointmentDate: '',
                AppointmentTime: '',
                AppointmentEndTime: '',
                AppointmentStartDateTime: '',
                AppointmentEndDateTime: '',
                AppointmentStatus: t('appointments.no_schedules', 'No scheduled appointments yet.'),
                AppointmentNotes: '',
                AppointmentProviderName: group.providerName,
                AppointmentLocation: group.locationDetails,
                AppointmentIsPlaceholder: true,
              },
            ];

        return {
          title: group.providerName,
          location: group.locationDetails,
          rawLocation: group.locationDetails,
          providerType: group.providerType,
          providerAddress: group.providerAddress,
          providerPhone: group.providerPhone,
          providerFax: group.providerFax,
          data,
        };
      });

      // Sort sections by earliest appointment date in each section
      const sortedSections = mappedSections.sort((a, b) => {
        // Get the earliest appointment from each section
        const aEarliest = a.data.find(item => !item.AppointmentIsPlaceholder);
        const bEarliest = b.data.find(item => !item.AppointmentIsPlaceholder);

        // If section a has no real appointments, put it at the end
        if (!aEarliest) return 1;
        // If section b has no real appointments, put it at the end
        if (!bEarliest) return -1;

        // Compare the earliest appointment dates
        const aDate = parseDateTime(aEarliest.AppointmentStartDateTime);
        const bDate = parseDateTime(bEarliest.AppointmentStartDateTime);
        const aTime = aDate ? aDate.getTime() : Number.POSITIVE_INFINITY;
        const bTime = bDate ? bDate.getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });

      setAppointmentSections(sortedSections);
      try {
        const stored = await getAllReminders();
        setReminders(stored);
      } catch {}
    } catch (err) {
      console.error('Failed to load appointments', err);
      setAppointmentSections([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUpcoming();
  }, []);

  const saveFreq = async (appt, freqArr = tempFreqs) => {
    const apptKey = appt.AppointmentKey;
    const existing = reminders[apptKey];
    if (existing?.notifIds) {
      for (const id of existing.notifIds) {
        try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
      }
    }

    const whenDate = (() => {
      const rawStart = appt.AppointmentStartDateTime;
      const parsed = rawStart ? new Date(rawStart) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        return parsed;
      }
      const dateParts = String(appt.AppointmentDate || '').split('/');
      if (dateParts.length === 3) {
        const [m, d, y] = dateParts.map(Number);
        const fallback = new Date(y, (m || 1) - 1, d || 1);
        if (!Number.isNaN(fallback.getTime())) {
          return fallback;
        }
      }
      return new Date();
    })();

    const timeToken = normalize(appt.AppointmentTime);
    if (timeToken) {
      const [timeValue, meridiemRaw] = timeToken.split(' ');
      const [hh, mm] = timeValue.split(':').map(Number);
      let hours = Number.isFinite(hh) ? hh : 0;
      const minutes = Number.isFinite(mm) ? mm : 0;
      const meridiem = (meridiemRaw || '').toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      whenDate.setHours(hours, minutes, 0, 0);
    }

    // schedule notifications
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) await Notifications.requestPermissionsAsync();
    const body = t('notification.appointment_details', {
      time: appt.AppointmentTime,
      date: appt.AppointmentDate,
    });
    const notifIds = [];
    for (const freq of freqArr) {
      const ms = frequencyToMs(freq);
      const when = new Date(whenDate.getTime() - ms);
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

    await setReminder(String(apptKey), { settings: freqArr, notifIds });
    setReminders(prev => ({ ...prev, [apptKey]: { settings: freqArr, notifIds } }));
    setTempFreqs(freqArr);
    setModalVisible(false);
  };

  const renderWheelItem = ({ label, fontSize, fontColor, textAlign }) => (
    <Text style={[styles.wheelText, { fontSize, color: fontColor, textAlign }]}>
      {label}
    </Text>
  );

  const renderItem = ({ item }) => {
    if (item.AppointmentIsPlaceholder) {
      return (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>{item.AppointmentStatus}</Text>
        </View>
      );
    }
    const current = reminders[item.AppointmentKey]?.settings || [...DEFAULT_FREQUENCIES];
    const statusLabel = item.AppointmentStatus || t('appointments.status_unknown', 'Status unknown');
    const dateLabel =
      formatFriendlyDate(item.AppointmentStartDateTime) ||
      [item.AppointmentDate, item.AppointmentTime].filter(Boolean).join(' ');
    const startDateObj = parseDateTime(item.AppointmentStartDateTime);
    const startTimeLabel = startDateObj ? formatDisplayTime(startDateObj) : item.AppointmentTime;
    const endTimeLabel = item.AppointmentEndTime || '';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.date}>{dateLabel}</Text>
            {(startTimeLabel || endTimeLabel) ? (
              <Text style={styles.timeRange}>
                {startTimeLabel || item.AppointmentTime}
                {endTimeLabel ? ` - ${endTimeLabel}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>
        {item.AppointmentNotes ? (
          <Text style={styles.notesText}>{item.AppointmentNotes}</Text>
        ) : null}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => openCalendarPrompt(item)}
          >
            <Ionicons name="calendar-outline" size={16} color="#2A7D8F" />
            <Text style={styles.calendarButtonText}>
              {t('appointments.add_to_calendar', 'Add to calendar')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.reminderRow}>
          {current.map((freq, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.reminderBox}
              onPress={() => {
                setModalAppt(item);
                setTempFreqs([...current]);
                setEditingIndex(idx);
                setModalVisible(true);
              }}
            >
              <Ionicons name="time-outline" size={16} color="#2A7D8F" />
              <Text style={styles.freqText}>{formatFreq(freq)}</Text>
            </TouchableOpacity>
          ))}
          {current.length < 4 && (
            <TouchableOpacity
              style={[styles.reminderBox, styles.addBox]}
              onPress={() => {
                setModalAppt(item);
                setTempFreqs([...current, { days: 0, hours: 1, minutes: 0 }]);
                setEditingIndex(current.length);
                setModalVisible(true);
              }}
            >
              <Ionicons name="add" size={16} color="#2A7D8F" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const extractAddress = value => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';
    const parts = raw.split(' - ');
    if (parts.length > 1) {
      return parts.slice(1).join(' - ').trim();
    }
    return raw;
  };

  const openMaps = location => {
    const addressOnly = extractAddress(location);
    const query = encodeURIComponent(addressOnly || '');
    if (!query) return;
    const appleUrl = `http://maps.apple.com/?q=${query}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

    Alert.alert(
      t('appointments.maps_title', 'Open directions'),
      t('appointments.maps_prompt', 'Choose a maps app'),
      [
        {
          text: t('appointments.maps_apple', 'Apple Maps'),
          onPress: async () => {
            const supported = await Linking.canOpenURL(appleUrl);
            await Linking.openURL(supported ? appleUrl : googleUrl);
          },
        },
        {
          text: t('appointments.maps_google', 'Google Maps'),
          onPress: async () => {
            await Linking.openURL(googleUrl);
          },
        },
        { text: t('cancel', 'Cancel'), style: 'cancel' },
      ],
    );
  };

  const renderSectionHeader = ({ section }) => {
    // Get the status from the first appointment in this section (if available)
    const firstAppointment = section.data?.[0];
    const hasStatus = firstAppointment && !firstAppointment.AppointmentIsPlaceholder;
    const statusLabel = hasStatus ? (firstAppointment.AppointmentStatus || 'Open') : null;

    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderTop}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionProvider}>{section.title}</Text>
            {section.providerType ? (
              <Text style={styles.sectionCategory}>
                {t('appointments.category', 'Category: {{type}}', { type: section.providerType })}
              </Text>
            ) : null}
          </View>
          <View style={styles.sectionHeaderRight}>
            {statusLabel ? (
              <View style={styles.sectionStatusBadge}>
                <Text style={styles.sectionStatusText}>{statusLabel}</Text>
              </View>
            ) : null}
            {(section.location || section.providerAddress) ? (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => openMaps(section.location || section.providerAddress)}
              >
                <Ionicons name="navigate-outline" size={16} color="#2A7D8F" />
                <Text style={styles.mapButtonText}>{t('appointments.directions', 'Directions')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {section.location ? (
          <Text style={styles.sectionLocation}>{section.location}</Text>
        ) : null}
        {section.providerAddress ? (
          <Text style={styles.sectionReferralAddress}>{section.providerAddress}</Text>
        ) : null}
        {(section.providerPhone || section.providerFax) ? (
          <Text style={styles.sectionDetail}>
            {section.providerPhone ? `Phone: ${section.providerPhone}` : ''}
            {section.providerFax ? `${section.providerPhone ? ' • ' : ''}Fax: ${section.providerFax}` : ''}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('appointments.title')}</Text>
        <TouchableOpacity onPress={loadUpcoming}>
          <Ionicons name="refresh" size={24} color="#2A7D8F" />
        </TouchableOpacity>
      </View>
      {(!refreshing && appointmentSections.length === 0) ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('appointment_list.no_upcoming')}</Text>
        </View>
      ) : (
        <SectionList
          sections={appointmentSections}
          keyExtractor={item =>
            String(item.AppointmentKey ?? `${item.AppointmentDate || 'unknown'}-${item.AppointmentTime || 'time'}`)
          }
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadUpcoming} />}
          contentContainerStyle={appointmentSections.length === 0 ? styles.emptyContainer : undefined}
          stickySectionHeadersEnabled={false}
          nestedScrollEnabled
        />
      )}

      <Modal
        transparent
        animationType="slide"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.unit}>{`Notification ${editingIndex + 1}`}</Text>
            <View style={styles.wheelRow}>
              {/* Days wheel */}
              <View style={styles.wheelColumn}>
                <Text style={styles.unit}>{t('reminder_frequency.days')}</Text>
                <WheelPickerExpo
                  height={200}
                  width={90}
                  items={Array.from({ length: 7 }, (_, i) => ({ label: String(i), value: i }))}
                  initialSelectedIndex={tempFreqs[editingIndex]?.days || 0}
                  onChange={({ item }) =>
                    setTempFreqs(s => {
                      const arr = [...s];
                      arr[editingIndex] = { ...arr[editingIndex], days: item.value };
                      return arr;
                    })
                  }
                  renderItem={renderWheelItem}
                  backgroundColor="#fff"
                  selectedStyle={{ borderColor: '#d8d8d8', borderWidth: 1 }}
                  flatListProps={{ showsVerticalScrollIndicator: false, nestedScrollEnabled: true }}
                />
              </View>

              {/* Hours wheel */}
              <View style={styles.wheelColumn}>
                <Text style={styles.unit}>{t('reminder_frequency.hours')}</Text>
                <WheelPickerExpo
                  height={200}
                  width={90}
                  items={Array.from({ length: 24 }, (_, i) => ({ label: String(i), value: i }))}
                  initialSelectedIndex={tempFreqs[editingIndex]?.hours || 0}
                  onChange={({ item }) =>
                    setTempFreqs(s => {
                      const arr = [...s];
                      arr[editingIndex] = { ...arr[editingIndex], hours: item.value };
                      return arr;
                    })
                  }
                  renderItem={renderWheelItem}
                  backgroundColor="#fff"
                  selectedStyle={{ borderColor: '#d8d8d8', borderWidth: 1 }}
                  flatListProps={{ showsVerticalScrollIndicator: false, nestedScrollEnabled: true }}
                />
              </View>

              {/* Minutes wheel */}
              <View style={styles.wheelColumn}>
                <Text style={styles.unit}>{t('reminder_frequency.minutes')}</Text>
                <WheelPickerExpo
                  height={200}
                  width={90}
                  items={Array.from({ length: 12 }, (_, i) => ({ label: String(i * 5), value: i * 5 }))}
                  initialSelectedIndex={Math.floor((tempFreqs[editingIndex]?.minutes || 0) / 5)}
                  onChange={({ item }) =>
                    setTempFreqs(s => {
                      const arr = [...s];
                      arr[editingIndex] = { ...arr[editingIndex], minutes: item.value };
                      return arr;
                    })
                  }
                  renderItem={renderWheelItem}
                  backgroundColor="#fff"
                  selectedStyle={{ borderColor: '#d8d8d8', borderWidth: 1 }}
                  flatListProps={{ showsVerticalScrollIndicator: false, nestedScrollEnabled: true }}
                />
              </View>
            </View>

            {tempFreqs.length > 1 && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  const updated = tempFreqs.filter((_, i) => i !== editingIndex);
                  setTempFreqs(updated);
                  saveFreq(modalAppt, updated);
                }}
              >
                <Ionicons name="trash" size={20} color="#4A6C82" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={() => saveFreq(modalAppt)}>
              <Text style={styles.saveText}>{t('reminder_frequency.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#EEF7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4E7EE',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B3A4B',
  },
  timeRange: {
    marginTop: 4,
    fontSize: 12,
    color: '#4A6C82',
  },
  statusBadge: {
    backgroundColor: '#2A7D8F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  notesText: {
    marginTop: 8,
    color: '#4A6C82',
    fontSize: 12,
  },
  placeholderCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#F7FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E3EEF3',
  },
  placeholderText: {
    color: '#6B7D87',
    fontSize: 12,
  },
  cardActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2A7D8F',
  },
  calendarButtonText: {
    marginLeft: 6,
    color: '#2A7D8F',
    fontWeight: '600',
    fontSize: 12,
  },
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EEF7FA',
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  addBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2A7D8F' },
  freqText: { marginLeft: 6, color: '#2A7D8F' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#999' },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E3EEF3',
  },
  sectionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderText: { flex: 1, paddingRight: 12 },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionProvider: { fontSize: 16, fontWeight: '700', color: '#1B3A4B' },
  sectionCategory: { marginTop: 2, color: '#2A7D8F', fontSize: 12, fontWeight: '600' },
  sectionLocation: { marginTop: 2, color: '#4A6C82', fontSize: 13 },
  sectionReferralAddress: {
    marginTop: 4,
    color: '#6B7D87',
    fontSize: 12,
    fontStyle: 'italic',
  },
  sectionDetail: { marginTop: 2, color: '#6B7D87', fontSize: 12 },
  sectionStatusBadge: {
    backgroundColor: '#2A7D8F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  sectionStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2FAFC',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C9E3EA',
  },
  mapButtonText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#2A7D8F',
    fontWeight: '600',
  },
  wheelRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  wheelColumn: { alignItems: 'center', minWidth: 90, marginVertical: 4 },
  wheelText: { fontSize: 20, textAlign: 'center' },
  unit: { marginBottom: 4, color: '#4A6C82', fontSize: 18 },
  saveBtn: {
    backgroundColor: '#4A6C82',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveText: { color: '#fff', fontSize: 16 },
  deleteBtn: { alignSelf: 'center', marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    color: '#2A7D8F',
    fontWeight: '600',
  },
});
