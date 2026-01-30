// frontend/screens/CalendarScreen.js
import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';  // your i18n setup

// Register English & Spanish labels
LocaleConfig.locales['en'] = {
  monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
};

export default function CalendarScreen({ navigation, route }) {
  const { onSelect } = route.params;
  const { i18n: i18nInstance } = useTranslation();

  useEffect(() => {
    LocaleConfig.defaultLocale = i18nInstance.language;
  }, [i18nInstance.language]);

  return (
    <SafeAreaView style={styles.wrapper}>
      <Calendar
        onDayPress={day => {
          onSelect(new Date(day.dateString));
          navigation.goBack();
        }}
        markedDates={{
          [new Date().toISOString().split('T')[0]]: {
            selected: true,
            selectedColor: '#4A6C82',
          },
        }}
        theme={{
          todayTextColor: '#2A7D8F',
          monthTextColor: '#2A7D8F',
          arrowColor: '#2A7D8F',
        }}
        style={styles.calendar}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#AEDAE9' },
  calendar: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
});
