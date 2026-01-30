// frontend/screens/RegisterScreen.js

import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_LOGIN, signUp } from '../services/auth';
import { loginUser } from '../services/authService';
import { setProgress as setLocalProgress } from '../services/localProgress';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState(DEFAULT_LOGIN.phone || '');
  const [pw,        setPw]        = useState(DEFAULT_LOGIN.password || '');
  const [confirm,   setConfirm]   = useState(DEFAULT_LOGIN.password || '');
  const [showPw,    setShowPw]    = useState(false);
  const [showCf,    setShowCf]    = useState(false);
  const [loading,   setLoading]   = useState(false);

  const passwordRegex =
    /^(?=.{8,20}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/;

  const formatPhone = txt => {
    const d = txt.replace(/\D/g, '').slice(0,10);
    if (d.length > 6) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`;
    return d;
  };

  const handleNext = async () => {
    console.log('[RegisterScreen] submit', { firstName, lastName, phone });

    if (!firstName.trim()) {
      return Alert.alert(t('error'), t('error_first_name_required'));
    }
    if (!lastName.trim()) {
      return Alert.alert(t('error'), t('error_last_name_required'));
    }
    if (!phone.replace(/\D/g, '')) {
      return Alert.alert(t('error'), t('error_phone_required'));
    }
    if (!pw) {
      return Alert.alert(t('error'), t('error_password_required'));
    }
    if (!passwordRegex.test(pw)) {
      return Alert.alert(t('invalid_password_title'), t('invalid_password_message'));
    }
    if (pw !== confirm) {
      return Alert.alert(t('passwords_do_not_match'));
    }

    const userId = phone.replace(/\D/g, '');
    setLoading(true);
    try {
      console.log('[RegisterScreen] calling signUp');
      // send phone instead of email
      await signUp({ firstName, lastName, phone: userId, password: pw });
      console.log('[RegisterScreen] calling loginUser');
      await loginUser({ UserId: userId, Password: pw });
      console.log('[RegisterScreen] navigation to PatientInfo');

      try {
        await AsyncStorage.multiSet([
          ['regFirstName', firstName],
          ['regLastName', lastName],
          ['regPhone', userId],
        ]);
      } catch {}

      try { await setLocalProgress(1); } catch {}

      navigation.navigate('PatientInfo', {
        firstName,
        lastName,
        password: pw,
        phone: userId
      });
    } catch (err) {
      const exists = /exist/i.test(err.message);
      const msg = exists
        ? 'Error: User already exists, please login to this account'
        : err.message || t('signup_failed_message');
      console.error('[RegisterScreen] sign up failed', err);
      Alert.alert(t('signup_failed_title'), msg);
    } finally {
      setLoading(false);
      console.log('[RegisterScreen] done');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('user_registration')}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* First Name */}
        <Text style={styles.label}>{t('first_name')}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={t('first_name_placeholder')}
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>

        {/* Last Name */}
        <Text style={styles.label}>{t('last_name')}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={t('last_name_placeholder')}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

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
        <Text style={styles.label}>{t('password')}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={t('password_placeholder')}
            secureTextEntry={!showPw}
            value={pw}
            onChangeText={setPw}
          />
          <TouchableOpacity onPress={() => setShowPw(v => !v)}>
            <Ionicons name={showPw ? 'eye' : 'eye-off'} size={20} color="#2A7D8F" />
          </TouchableOpacity>
        </View>

        {/* Confirm Password */}
        <Text style={styles.label}>{t('confirm_password')}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={t('password_placeholder')}
            secureTextEntry={!showCf}
            value={confirm}
            onChangeText={setConfirm}
          />
          <TouchableOpacity onPress={() => setShowCf(v => !v)}>
            <Ionicons name={showCf ? 'eye' : 'eye-off'} size={20} color="#2A7D8F" />
          </TouchableOpacity>
        </View>

        {/* Sign Up */}
        <TouchableOpacity
          style={styles.signUpBtn}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signUpText}>{t('signup')}</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('already_have_account')} </Text>
          <Text
            style={[styles.footerText, styles.link]}
            onPress={() => navigation.navigate('Login')}
          >
            {t('login.title')}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  title: { fontSize: 20, color: '#2A7D8F', fontWeight: '600' },
  label: { color: '#2A7D8F', marginLeft: 4, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#AEDAE9',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 16,
  },
  input: { flex: 1, height: '100%' },
  signUpBtn: {
    backgroundColor: '#4A6C82',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  signUpText: { color: '#fff', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#2A7D8F' },
  link: { textDecorationLine: 'underline' },
});
