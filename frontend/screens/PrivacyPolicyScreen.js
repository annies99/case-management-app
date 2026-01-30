import React from 'react';
import { SafeAreaView, ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicyScreen({ navigation }) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={p.wrapper}>
      <View style={p.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
          <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
        </TouchableOpacity>
        <Text style={p.title}>{t('privacy.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={p.content}>
        <Text style={p.updated}>
          {t('privacy.last_updated', { date: 'June 16, 2025' })}
        </Text>
        <Text style={p.text}>{t('privacy.intro')}</Text>

        <Text style={p.subheading}>{t('privacy.section1_title')}</Text>
        <Text style={p.text}>{t('privacy.section1_text')}</Text>

        <Text style={p.subheading}>{t('privacy.section2_title')}</Text>
        <Text style={p.text}>{t('privacy.section2_text')}</Text>

        <Text style={p.subheading}>{t('privacy.section3_title')}</Text>
        <Text style={p.text}>{t('privacy.section3_text')}</Text>

        <Text style={p.subheading}>{t('privacy.section4_title')}</Text>
        <Text style={p.text}>{t('privacy.section4_text')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header:   { flexDirection: 'row', alignItems: 'center', padding: 20 },
  title:    { flex: 1, textAlign: 'center', fontSize: 20, color: '#2A7D8F', fontWeight: '600' },
  content:  { padding: 20 },
  updated:  { marginBottom: 12, color: '#666' },
  subheading: {
    fontSize: 16,
    color: '#2A7D8F',
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6
  },
  text: { lineHeight: 20, color: '#333' }
});
