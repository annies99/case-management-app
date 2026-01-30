import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'progressStep';

export async function getProgress() {
  const val = await AsyncStorage.getItem(KEY);
  return val ? Number(val) : 0;
}

export async function setProgress(step) {
  await AsyncStorage.setItem(KEY, String(step));
}

export async function clearProgress() {
  await AsyncStorage.removeItem(KEY);
}
