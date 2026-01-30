import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET } from '../config/constants';

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

/**
 * @typedef {Object} AppointmentGroup
 * @property {string} providerName
 * @property {string} providerType
 * @property {string} providerAddress
 * @property {string} providerPhone
 * @property {string} providerFax
 * @property {string} locationDetails
 * @property {string} referralDate
 * @property {string|number} referralKey
 * @property {{ startDateTime: string, endDateTime: string, status: string, comments: string }[]} schedules
 */

const isExcludedReferralType = value => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === 'agent' || normalized === 'hospital';
};

/**
 * @param {string|number} patientKey
 * @returns {Promise<AppointmentGroup[]>}
 */
export async function getMyAppointments(patientKey) {
  console.log('[appointments] GET /referrals/list', { patientKey });
  const { data: referralResponse } = await apiClient.get('/referrals/list', {
    params: { patientKey },
  });
  console.log('[appointments] referrals response', referralResponse);

  if (!referralResponse?.success) {
    throw new Error(referralResponse?.message || 'Failed to fetch referrals.');
  }

  const referrals = Array.isArray(referralResponse?.result) ? referralResponse.result : [];
  const eligible = referrals.filter(referral => {
    const type = referral?.ReferredBy?.Type ?? referral?.Type ?? referral?.ReferralType ?? '';
    return !isExcludedReferralType(type);
  });

  const groups = await Promise.all(
    eligible.map(async referral => {
      const referralKey =
        referral?.ReferalKey ??
        referral?.ReferralKey ??
        referral?.referralKey ??
        referral?.Referral?.ReferalKey ??
        referral?.Referral?.ReferralKey ??
        null;

      console.log('[appointments] GET /referralschedules/list', {
        referralKey,
        providerName: referral?.ReferredBy?.Name ?? referral?.ProviderName ?? 'Provider',
      });

      if (!referralKey) {
      const rawProviderName = referral?.ReferredBy?.Name ?? 'Provider';
      const providerName = rawProviderName.split(',')[0].trim() || rawProviderName;

      return {
        providerName,
        providerType: referral?.ReferredBy?.Type ?? '',
        providerAddress: referral?.ReferredBy?.Address ?? '',
        providerPhone: referral?.ReferredBy?.Phone ?? '',
        providerFax: referral?.ReferredBy?.Fax ?? '',
        locationDetails: referral?.Comments ?? '',
        referralDate: referral?.ReferralDate ?? '',
        referralKey: '',
        schedules: [],
      };
      }

      let schedules = [];
      try {
        const { data: scheduleResponse } = await apiClient.get('/referralschedules/list', {
          params: { referralKey },
        });
        console.log('[appointments] schedules response', scheduleResponse);
        if (scheduleResponse?.success && Array.isArray(scheduleResponse?.result)) {
          schedules = scheduleResponse.result.map(schedule => ({
            startDateTime:
              schedule?.StartDateTime ??
              schedule?.startDateTime ??
              schedule?.Start ??
              schedule?.start ??
              '',
            endDateTime:
              schedule?.EndDateTime ??
              schedule?.endDateTime ??
              schedule?.End ??
              schedule?.end ??
              '',
            status:
              schedule?.Status ??
              schedule?.status ??
              schedule?.ScheduleStatus ??
              'Open',
            comments: schedule?.Comments ?? schedule?.comments ?? '',
          }));
        }
      } catch {
        schedules = [];
      }

      const rawProviderName = referral?.ReferredBy?.Name ?? 'Provider';
      const providerName = rawProviderName.split(',')[0].trim() || rawProviderName;

      return {
        providerName,
        providerType: referral?.ReferredBy?.Type ?? '',
        providerAddress: referral?.ReferredBy?.Address ?? '',
        providerPhone: referral?.ReferredBy?.Phone ?? '',
        providerFax: referral?.ReferredBy?.Fax ?? '',
        locationDetails: referral?.Comments ?? '',
        referralDate: referral?.ReferralDate ?? '',
        referralKey,
        schedules,
      };
    }),
  );

  return groups;
}
