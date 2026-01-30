// frontend/screens/ForgotPasswordNewPasswordScreen.js

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
import { setPasswordWithOTP } from '../services/authService';

export default function ForgotPasswordNewPasswordScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { userId, otp } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password) return Alert.alert(t('error'), t('error_password_required'));
    if (password !== confirm) {
      return Alert.alert(t('error'), t('passwords_do_not_match'));
    }
    setLoading(true);
    try {
      await setPasswordWithOTP({ UserId: userId, LoginOTP: otp, Password: password });
      Alert.alert(
        t('forgot_password.reset_success'),
        '',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
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
          <Text style={styles.bodyText}>{t('forgot_password.password_body')}</Text>
          <Text style={styles.label}>{t('forgot_password.new_password_label')}</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          <Text style={styles.label}>{t('forgot_password.confirm_password_label')}</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('forgot_password.reset_button')}</Text>
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

