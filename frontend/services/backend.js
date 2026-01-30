// frontend/services/backend.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, APP_SECRET } from '../config/constants';

const client = axios.create({
  baseURL: API_URL,
  headers: { AppSecret: APP_SECRET },
});

client.interceptors.request.use(async cfg => {
  const token = await SecureStore.getItemAsync('sessionToken');
  if (token) cfg.headers.Token = token;
  return cfg;
});

export default client;
