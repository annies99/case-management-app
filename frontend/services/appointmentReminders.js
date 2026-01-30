import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'appointmentReminders';

export async function getAllReminders() {
  const json = await AsyncStorage.getItem(KEY);
  return json ? JSON.parse(json) : {};
}

export async function getReminder(apptKey) {
  const all = await getAllReminders();
  return all[apptKey];
}

export async function setReminder(apptKey, data) {
  const all = await getAllReminders();
  all[apptKey] = data;
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function removeReminder(apptKey) {
  const all = await getAllReminders();
  if (all[apptKey]) {
    delete all[apptKey];
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  }
}
