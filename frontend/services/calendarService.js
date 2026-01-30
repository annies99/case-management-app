import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET } from '../config/constants';

const apiClient = axios.create({
  baseURL: BASE_API_URL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'AppSecret': APP_SECRET,
  },
  // 30 second timeout to handle slower networks
  timeout: 30000,
});

apiClient.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) config.headers.Token = token;
    return config;
  },
  err => Promise.reject(err)
);

apiClient.interceptors.response.use(
  res => res,
  err => Promise.reject(err.response?.data || { success: false, message: err.message })
);

/**
 * List a patient’s appointments.
 * GET /appointment/list?patientKey=123
 */
export async function listAppointments(patientKey) {
  const { data } = await apiClient.get(
    '/appointment/list',
    { params: { patientKey } }
  );
  if (!data.success) throw new Error(data.message || 'Failed to fetch appointments');
  return data.result;
}
