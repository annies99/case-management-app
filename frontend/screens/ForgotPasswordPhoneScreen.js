// frontend/screens/ForgotPasswordPhoneScreen.js

import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '../services/authService';

const formatPhone = txt => {
  const d = txt.replace(/\D/g, '').slice(0, 10);
  if (d.length > 6) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`;
  return d;
};

export default function ForgotPasswordPhoneScreen({ navigation }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    const userId = phone.replace(/\D/g, '');
    if (!userId) return Alert.alert(t('error'), t('error_phone_required'));
    setLoading(true);
    try {
      await requestPasswordReset({ UserId: userId });
      Alert.alert(t('forgot_password.code_sent'));
      navigation.navigate('ForgotPasswordOTP', { userId });
    } catch (err) {
      Alert.alert(t('error'), err.message || t('forgot_password.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('forgot_password.title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.bodyText}>{t('forgot_password.body')}</Text>
          <Text style={styles.label}>{t('forgot_password.phone_label')}</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="987-654-3242"
              value={phone}
              onChangeText={txt => setPhone(formatPhone(txt))}
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleRequest} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('forgot_password.send_code')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 20, color: '#2A7D8F', fontWeight: '600' },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  bodyText: {
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    color: '#2A7D8F',
    marginLeft: 4,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#AEDAE9',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 12,
  },
  input: { flex: 1 },
  button: {
    backgroundColor: '#4A6C82',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});

