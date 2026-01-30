// frontend/screens/LoginScreen.js

import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { loginUser, getAuthToken } from '../services/authService';

const formatPhone = txt => {
  const d = txt.replace(/\D/g, '').slice(0, 10);
  if (d.length > 6) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`;
  return d;
};

export default function LoginScreen({ navigation, onSignIn }) {
  const { t } = useTranslation();
  const [phone, setPhone]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const userId = phone.replace(/\D/g, '');
      console.log('[LoginScreen] loginUser', { userId });
      const res = await loginUser({ UserId: userId, Password: password });
      console.log('[LoginScreen] loginUser response', res);
      console.log('[LoginScreen] cached token', getAuthToken());

      const key = Array.isArray(res.result) ? res.result[0] : res.result;
      await AsyncStorage.setItem('patientKey', String(key));
      onSignIn(key);
    } catch (err) {
      const raw = `${err.message || err.Message || err.error || ''}`.toLowerCase();
      let msg;
      if (
        err.status === 401 ||
        err.status === 400 ||
        /unauthorized|unauthenticated|invalid|password/i.test(raw)
      ) {
        msg = t('login.error_invalid_credentials');
      } else if (err.status === 404 || /not\s*(found|exist)/i.test(raw)) {
        msg = t('login.error_user_not_found');
      } else if (/network|timeout|connect|failed/i.test(raw)) {
        msg = t('login.error_network');
      } else if (err.status >= 500) {
        msg = t('login.error_server');
      } else {
        msg = t('login.error_unknown');
      }
      alert(msg);
    } finally {
      setLoading(false);
      console.log('[LoginScreen] done');
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
          <Text style={styles.title}>{t('login.title')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{t('login.heading')}</Text>
          <Text style={styles.bodyText}>{t('login.body')}</Text>

          {/* Phone */}
          <Text style={styles.label}>Phone Number*</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="987-654-3242"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={text => setPhone(formatPhone(text))}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>{t('login.password_label')}</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={t('login.password_placeholder')}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
              <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#2A7D8F" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPasswordPhone')}>
            <Text style={styles.forget}>{t('login.forgot_password')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginText}>{t('login.login_button')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('login.no_account')}</Text>
            <Text
              style={[styles.footerText, styles.link]}
              onPress={() => navigation.navigate('Register')}
            >
              {t('login.sign_up')}
            </Text>
          </View>
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
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
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
  forget: {
    alignSelf: 'flex-end',
    color: '#2A7D8F',
    marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: '#4A6C82',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginText: { color: '#fff', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  footerText: { color: '#2A7D8F' },
  link: { textDecorationLine: 'underline' },
});
