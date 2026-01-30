// frontend/services/notificationService.js

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notifications';

export async function getNotifications() {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

export async function addNotification(note) {
  // note must include: dateGroupKey, icon, titleKey, textKey, time
  const current = await getNotifications();
  const now = new Date().toISOString();
  const toStore = [
    {
      id: now,             // unique ID
      date: now,           // raw timestamp
      ...note,
    },
    ...current,
  ];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  return toStore;
}
