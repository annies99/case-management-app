import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

const DEFAULT_MIN = new Date(1900, 0, 1);
const DEFAULT_MAX = new Date(2100, 11, 31, 23, 59, 59, 999);

const ensureDate = value => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    if (!Number.isNaN(fromNumber.getTime())) {
      return fromNumber;
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const year = Number(y);
      const month = Number(m);
      const day = Number(d);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        const isoDate = new Date(year, month - 1, day);
        if (!Number.isNaN(isoDate.getTime())) {
          isoDate.setHours(0, 0, 0, 0);
          return isoDate;
        }
      }
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const clampDate = (value, minDate, maxDate) => {
  const safeValue = ensureDate(value) || new Date();
  const safeMin = ensureDate(minDate) || DEFAULT_MIN;
  const safeMax = ensureDate(maxDate) || DEFAULT_MAX;

  const minTime = safeMin.getTime();
  const maxTime = safeMax.getTime();
  const valueTime = safeValue.getTime();

  if (valueTime < minTime) return new Date(minTime);
  if (valueTime > maxTime) return new Date(maxTime);
  return safeValue;
};

const monthLabels = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleString(undefined, { month: 'long' })
);

const getMonthOptions = (year, minDate, maxDate) => {
  const minYear = minDate.getFullYear();
  const maxYear = maxDate.getFullYear();
  const startMonth = year === minYear ? minDate.getMonth() : 0;
  const endMonth = year === maxYear ? maxDate.getMonth() : 11;

  const months = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push({ value: month, label: monthLabels[month] });
  }
  return months;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const getDayOptions = (year, month, minDate, maxDate) => {
  const minYear = minDate.getFullYear();
  const maxYear = maxDate.getFullYear();
  const minMonth = minDate.getMonth();
  const maxMonth = maxDate.getMonth();

  const isMinMonth = year === minYear && month === minMonth;
  const isMaxMonth = year === maxYear && month === maxMonth;

  const startDay = isMinMonth ? minDate.getDate() : 1;
  const endDay = isMaxMonth ? maxDate.getDate() : getDaysInMonth(year, month);

  const days = [];
  for (let day = startDay; day <= endDay; day += 1) {
    days.push(day);
  }
  return days;
};

const maybeSwapBounds = (minDate, maxDate) => {
  const minTime = minDate.getTime();
  const maxTime = maxDate.getTime();
  if (minTime <= maxTime) {
    return { min: minDate, max: maxDate };
  }
  return { min: maxDate, max: minDate };
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 18,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    alignSelf: 'center',
    width: '100%',
    flexWrap: 'wrap',
  },
  pickerColumn: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  pickerMonthColumn: {
    flexGrow: 1.35,
    flexShrink: 1,
    flexBasis: '48%',
    minWidth: 0,
  },
  pickerDayColumn: {
    flexGrow: 0.95,
    flexShrink: 1,
    flexBasis: '26%',
    minWidth: 0,
  },
  pickerYearColumn: {
    flexGrow: 1.1,
    flexShrink: 1,
    flexBasis: '26%',
    minWidth: 0,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: Platform.OS === 'ios' ? 8 : 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  picker: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickerItem: {
    color: '#0f172a',
    fontSize: 18,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    width: '100%',
    maxWidth: 360,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButton: {
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  confirmButton: {
    backgroundColor: '#2A7D8F',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default function SimpleDatePickerModal({
  visible,
  initialDate,
  minimumDate,
  maximumDate,
  title = 'Select date',
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  monthLabel = 'Month',
  dayLabel = 'Day',
  yearLabel = 'Year',
  onCancel,
  onConfirm,
}) {
  const safeMin = useMemo(() => ensureDate(minimumDate) || DEFAULT_MIN, [minimumDate]);
  const safeMax = useMemo(() => ensureDate(maximumDate) || DEFAULT_MAX, [maximumDate]);
  const { min: normalizedMin, max: normalizedMax } = useMemo(
    () => maybeSwapBounds(safeMin, safeMax),
    [safeMin, safeMax],
  );

  const clampedInitial = useMemo(
    () => clampDate(initialDate, normalizedMin, normalizedMax),
    [initialDate, normalizedMin, normalizedMax],
  );

  const [selectedYear, setSelectedYear] = useState(clampedInitial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(clampedInitial.getMonth());
  const [selectedDay, setSelectedDay] = useState(clampedInitial.getDate());

  useEffect(() => {
    if (visible) {
      const normalized = clampDate(initialDate, normalizedMin, normalizedMax);
      setSelectedYear(normalized.getFullYear());
      setSelectedMonth(normalized.getMonth());
      setSelectedDay(normalized.getDate());
    }
  }, [visible, initialDate, normalizedMin, normalizedMax]);

  const years = useMemo(() => {
    const minYear = normalizedMin.getFullYear();
    const maxYear = normalizedMax.getFullYear();
    const range = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      range.push(year);
    }
    return range;
  }, [normalizedMin, normalizedMax]);

  const months = useMemo(
    () => getMonthOptions(selectedYear, normalizedMin, normalizedMax),
    [selectedYear, normalizedMin, normalizedMax],
  );

  useEffect(() => {
    if (!months.some(month => month.value === selectedMonth)) {
      const fallbackMonth = months[0]?.value ?? 0;
      setSelectedMonth(fallbackMonth);
    }
  }, [months, selectedMonth]);

  const days = useMemo(
    () => getDayOptions(selectedYear, selectedMonth, normalizedMin, normalizedMax),
    [selectedYear, selectedMonth, normalizedMin, normalizedMax],
  );

  useEffect(() => {
    if (!days.includes(selectedDay)) {
      const fallbackDay = days[0] ?? 1;
      setSelectedDay(fallbackDay);
    }
  }, [days, selectedDay]);

  const handleYearChange = newYear => {
    setSelectedYear(newYear);
  };

  const handleMonthChange = newMonth => {
    setSelectedMonth(newMonth);
  };

  const handleDayChange = newDay => {
    setSelectedDay(newDay);
  };

  const handleConfirm = () => {
    const candidate = new Date(selectedYear, selectedMonth, selectedDay);
    candidate.setHours(0, 0, 0, 0);
    const safeCandidate = clampDate(candidate, normalizedMin, normalizedMax);
    onConfirm?.(safeCandidate);
  };

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <View style={styles.pickerRow}>
            <View style={[styles.pickerColumn, styles.pickerMonthColumn]}>
              <Text style={styles.pickerLabel}>{monthLabel}</Text>
              <Picker
                selectedValue={selectedMonth}
                onValueChange={handleMonthChange}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {months.map(month => (
                  <Picker.Item key={month.value} label={month.label} value={month.value} />
                ))}
              </Picker>
            </View>
            <View style={[styles.pickerColumn, styles.pickerDayColumn]}>
              <Text style={styles.pickerLabel}>{dayLabel}</Text>
              <Picker
                selectedValue={selectedDay}
                onValueChange={handleDayChange}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {days.map(day => (
                  <Picker.Item key={day} label={String(day)} value={day} />
                ))}
              </Picker>
            </View>
            <View style={[styles.pickerColumn, styles.pickerYearColumn]}>
              <Text style={styles.pickerLabel}>{yearLabel}</Text>
              <Picker
                selectedValue={selectedYear}
                onValueChange={handleYearChange}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {years.map(year => (
                  <Picker.Item key={year} label={String(year)} value={year} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.button, styles.cancelButton]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.button, styles.confirmButton]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
