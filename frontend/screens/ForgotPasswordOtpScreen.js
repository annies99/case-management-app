// frontend/screens/ForgotPasswordOtpScreen.js

import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '../services/authService';

export default function ForgotPasswordOtpScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { userId } = route.params;
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = text => {
    const sanitized = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(sanitized);
  };

  const otp = code;

  const handleNext = () => {
    if (otp.length !== 6)
      return Alert.alert(t('error'), t('forgot_password.otp_required'));
    navigation.navigate('ForgotPasswordNewPassword', { userId, otp });
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await requestPasswordReset({ UserId: userId });
      Alert.alert(t('forgot_password.code_sent'));
    } catch (err) {
      Alert.alert(t('error'), err.message || t('forgot_password.error'));
    } finally {
      setResending(false);
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
          <Text style={styles.bodyText}>{t('forgot_password.code_body')}</Text>
          <Text style={styles.label}>{t('forgot_password.otp_label')}</Text>
          <View style={styles.otpContainer}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.otpInput}
                activeOpacity={1}
                onPress={() => inputRef.current?.focus()}
              >
                <Text style={styles.otpText}>{code[idx] || ''}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleChange}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              style={styles.hiddenInput}
              autoFocus
            />
          </View>
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>{t('forgot_password.no_code')}</Text>
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>{t('forgot_password.resend')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>{t('forgot_password.next_button')}</Text>
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: '#AEDAE9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpText: {
    fontSize: 18,
    color: '#2A7D8F',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resendText: {
    color: '#666',
  },
  resendLink: {
    color: '#2A7D8F',
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#4A6C82',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});

