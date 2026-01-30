import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function ContactUsScreen({ navigation }) {
  const { t } = useTranslation();

  const phoneNumber = t('contact_us.phone_value');
  const phoneDigits = phoneNumber.replace(/\D/g, '');
  const website = t('contact_us.website_value');
  const normalizedWebsite = website.startsWith('http') ? website : `https://${website}`;

  const handleCallPress = async () => {
    try {
      await Linking.openURL(`tel:${phoneDigits}`);
    } catch (err) {
      console.warn('Failed to open phone dialer', err);
    }
  };

  const handleWebsitePress = async () => {
    try {
      await Linking.openURL(normalizedWebsite);
    } catch (err) {
      console.warn('Failed to open website', err);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
          <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('contact_us.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.heading}>{t('contact_us.heading')}</Text>
        <Text style={styles.address}>{t('contact_us.address_line1')}</Text>
        <Text style={styles.address}>{t('contact_us.address_line2')}</Text>

        <TouchableOpacity style={styles.actionRow} onPress={handleCallPress}>
          <Ionicons name="call-outline" size={20} color="#2A7D8F" style={styles.icon} />
          <View>
            <Text style={styles.label}>{t('contact_us.phone_label')}</Text>
            <Text style={styles.value}>{phoneNumber}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={handleWebsitePress}>
          <Ionicons name="globe-outline" size={20} color="#2A7D8F" style={styles.icon} />
          <View>
            <Text style={styles.label}>{t('contact_us.website_label')}</Text>
            <Text style={styles.value}>{website}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    color: '#2A7D8F',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  heading: {
    fontSize: 18,
    color: '#2A7D8F',
    fontWeight: '600',
    marginBottom: 12,
  },
  address: {
    fontSize: 16,
    color: '#444',
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  icon: {
    marginRight: 12,
  },
  label: {
    color: '#666',
    fontSize: 14,
    marginBottom: 2,
  },
  value: {
    color: '#2A7D8F',
    fontSize: 16,
    fontWeight: '600',
  },
});
