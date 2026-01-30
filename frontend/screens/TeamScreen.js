// frontend/screens/TeamScreen.js

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTeam } from '../services/teamService';
import {
  listReferralSchedules,
  formatScheduleForDisplay,
} from '../services/referralScheduleService';

const SCHEDULE_KEYS = [
  'ScheduleDate',
  'ScheduledDate',
  'ScheduleDateTime',
  'ScheduledDateTime',
  'NextScheduledDate',
];

function parseDateValue(value) {
  if (!value || value === '0000-00-00' || value === '0000-00-00T00:00:00') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') return null;

    const match = /Date\((\d+)\)/.exec(trimmed);
    if (match) {
      const fromEpoch = new Date(Number(match[1]));
      return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
    }

    const fromString = new Date(trimmed);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }

  return null;
}

function getScheduleDate(referral) {
  if (!referral) return null;

  const sources = [referral, referral.Schedule, referral.Appointment];
  for (const source of sources) {
    if (!source) continue;
    for (const key of SCHEDULE_KEYS) {
      const parsed = parseDateValue(source[key]);
      if (parsed) return parsed;
    }
  }

  return null;
}

function formatScheduleDate(date) {
  if (!date) return null;
  try {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (err) {
    return date.toISOString().split('T')[0];
  }
}

function buildAddress(source) {
  if (!source) return '';

  const candidates = [
    source.Address,
    [source.Address1, source.Address2].filter(Boolean).join(' ').trim(),
    source.AddressLine1,
    source.FullAddress,
  ].filter(Boolean);

  const cityState = [source.City, source.State || source.StateCode].filter(Boolean).join(', ');
  const postal = source.Zip || source.ZipCode || source.PostalCode || source.Zipcode;

  const parts = [...candidates];
  if (cityState) parts.push(cityState);
  if (postal) parts.push(postal);

  return parts
    .map(part => (typeof part === 'string' ? part.trim() : part))
    .filter(part => part && part.length)
    .join(', ');
}

export default function TeamScreen({ navigation }) {
  const [team, setTeam] = useState([]);
  // NEW: Store schedules for each referral
  const [schedules, setSchedules] = useState({});
  const [loadingSchedules, setLoadingSchedules] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const list = await getTeam();
        console.log('[TeamScreen] fetched team:', list);
        setTeam(list);

        // NEW: Fetch schedules for each referral that has a ReferralKey
        for (const referral of list) {
          const referralKey = referral.ReferralKey || referral.ReferalKey;
          if (referralKey) {
            setLoadingSchedules(prev => ({ ...prev, [referralKey]: true }));
            try {
              const scheduleList = await listReferralSchedules(referralKey);
              setSchedules(prev => ({ ...prev, [referralKey]: scheduleList }));
            } catch (err) {
              console.warn(`Failed to load schedules for referral ${referralKey}:`, err);
              setSchedules(prev => ({ ...prev, [referralKey]: [] }));
            } finally {
              setLoadingSchedules(prev => ({ ...prev, [referralKey]: false }));
            }
          }
        }
      } catch (err) {
        console.warn('Team load failed', err);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
          <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
        </TouchableOpacity>
        <Text style={styles.title}>Meet Your Team</Text>
        {/* placeholder so title stays centered */}
        <View style={{ width: 28 }} />
      </View>

      {/* List */}
      <FlatList
        data={team}
        keyExtractor={item => String(item.ReferalKey)}
        contentContainerStyle={team.length ? {} : { flex:1, justifyContent:'center' }}
        ListEmptyComponent={
          <Text style={styles.empty}>No team found.</Text>
        }
        renderItem={({ item, index }) => {
          // some APIs call this ReferredTo, others ReferredBy
          const who = item.ReferredTo || item.ReferredBy || {};
          const scheduleDate = getScheduleDate(item);
          const scheduleDisplay = formatScheduleDate(scheduleDate);
          const address = buildAddress(who) || buildAddress(item);

          // NEW: Get schedules for this referral
          const referralKey = item.ReferralKey || item.ReferalKey;
          const referralSchedules = referralKey ? schedules[referralKey] : null;
          const isLoadingSchedules = referralKey ? loadingSchedules[referralKey] : false;

          return (
            <View style={styles.row}>
              <Text style={styles.index}>{index + 1}.</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{who.Name}</Text>
                <Text style={styles.detail}>({who.Type})</Text>
                {scheduleDisplay && (
                  <Text style={styles.detail}>Scheduled: {scheduleDisplay}</Text>
                )}
                {address && <Text style={styles.detail}>{address}</Text>}
                {who.Phone && <Text style={styles.detail}>{who.Phone}</Text>}

                {/* NEW: Display referral schedules */}
                {referralKey && (
                  <View style={{ marginTop: 8 }}>
                    {isLoadingSchedules ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#2A7D8F" />
                        <Text style={[styles.detail, { marginLeft: 8 }]}>Loading appointments...</Text>
                      </View>
                    ) : referralSchedules && referralSchedules.length > 0 ? (
                      <>
                        <Text style={[styles.detail, { fontWeight: '600', marginBottom: 4 }]}>
                          Appointments ({referralSchedules.length}):
                        </Text>
                        {referralSchedules.map((schedule, idx) => {
                          const formatted = formatScheduleForDisplay(schedule);
                          return (
                            <View key={schedule.ReferralScheduleKey || idx} style={{ marginLeft: 8, marginTop: 2 }}>
                              <Text style={styles.detail}>
                                • {formatted.date} at {formatted.time}
                              </Text>
                              {formatted.status && (
                                <Text style={[styles.detail, { marginLeft: 12, fontSize: 12 }]}>
                                  Status: {formatted.status}
                                </Text>
                              )}
                              {formatted.comments && (
                                <Text style={[styles.detail, { marginLeft: 12, fontSize: 12, fontStyle: 'italic' }]}>
                                  {formatted.comments}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </>
                    ) : referralSchedules && referralSchedules.length === 0 ? (
                      <Text style={[styles.detail, { fontStyle: 'italic' }]}>
                        No appointments scheduled yet
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection:'row',
    alignItems:'center',
    padding:20,
  },
  title: {
    flex:1,
    textAlign:'center',
    fontSize:20,
    color:'#2A7D8F',
    fontWeight:'600',
  },
  row: {
    flexDirection:'row',
    paddingHorizontal:20,
    paddingVertical:12,
    borderBottomWidth:1,
    borderColor:'#eee',
  },
  index: {
    width:24,
    fontSize:16,
    color:'#2A7D8F',
  },
  info: {
    flex:1,
  },
  name: {
    fontSize:16,
    color:'#2A7D8F',
    fontWeight:'600',
  },
  detail: {
    color:'#666',
    marginTop:2,
  },
  empty: {
    textAlign:'center',
    color:'#999',
    fontSize:16,
  },
});
