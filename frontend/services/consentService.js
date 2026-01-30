// frontend/services/consentService.js
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_SECRET, BASE_API_URL } from '../config/constants';

async function resolveToken(explicit) {
  if (explicit) return explicit;                       // allow override
  // same chain used across app
  return (
    (await SecureStore.getItemAsync('sessionToken')) ||
    (await AsyncStorage.getItem('authToken')) ||
    null
  );
}

export async function uploadConsentHTML({
  patientKey,
  html,
  documentType = 'Communication',
  subject = 'Consent',
  baseUrl = BASE_API_URL,
  token,                               // optional; auto-resolved if omitted
}) {
  const resolvedToken = await resolveToken(token);
  if (!resolvedToken) throw new Error('Missing Token');
  if (!APP_SECRET) throw new Error('Missing AppSecret');

  const form = new URLSearchParams({
    PatientKey: String(patientKey),
    DocumentType: documentType,
    Subject: subject,
    DocumentDate: new Date().toISOString().slice(0,10), // YYYY-MM-DD
    Notes: '',
    ScheduleKey: '',
    EncounterKey: '',
    HtmlContent: html,
  }).toString();

  const res = await fetch(`${baseUrl}/patient/documentupload`, {
    method: 'POST',
    headers: {
      Token: resolvedToken,                 // same JWT you already store
      AppSecret: APP_SECRET,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!res.ok) throw new Error(`Consent upload failed: ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}
