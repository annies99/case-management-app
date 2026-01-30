// frontend/services/teamService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET } from '../config/constants';

const apiClient = axios.create({
  baseURL: BASE_API_URL,
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', AppSecret: APP_SECRET },
});

// fetch patient’s referrals
export async function getTeam() {
  const patientKey = await AsyncStorage.getItem('patientKey');
  if (!patientKey) throw new Error('No patientKey in storage');

  // grab auth token if we have one
  const token = await AsyncStorage.getItem('authToken');
  const { data } = await apiClient.get('/referrals/list', {
    params: { patientKey },
    headers: token ? { Token: token } : {},
  });

  console.log('[teamService] raw response:', data);

  if (!data.success) throw new Error(data.message || 'Failed to fetch team');
  return data.result;  // this is your array of referral objects
}
