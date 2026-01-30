export const DEFAULT_FREQUENCY = { days: 0, hours: 1, minutes: 0 };
export const DEFAULT_FREQUENCIES = [
  { days: 1, hours: 0, minutes: 0 }, // 1 day before
  { days: 0, hours: 1, minutes: 0 }, // 1 hour before
];

export function frequencyToMs({ days = 0, hours = 0, minutes = 0 }) {
  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
}
