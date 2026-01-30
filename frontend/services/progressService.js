// frontend/services/progressService.js
import client from './backend';

export async function getProgress(user) {
  const { data } = await client.get('/progress', { params: { user } });
  return data.progress ?? 0;
}

export async function setProgress(user, progress) {
  const { data } = await client.post('/progress', { user, progress });
  return data;
}
