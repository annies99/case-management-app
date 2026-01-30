// frontend/screens/SignupScreen.js
import React, { useState } from 'react';
import { View, TextInput, Alert, StyleSheet } from 'react-native';
import Button from '../../components/common/Button';
import {
  createUserAndAuthenticate,
  createChart
} from '../../services/authService';

export default function SignupScreen({ navigation }) {
  const [form, setForm] = useState({
    FirstName: '',
    LastName: '',
    PhoneNo: '',
    Email: '',
    Password: '',
    UserId: ''
  });
  const [loading, setLoading] = useState(false);

  const update = key => val => setForm(f => ({ ...f, [key]: val }));

  const onSignup = async () => {
    setLoading(true);
    try {
      // 1) register & get your raw auth string stored
      await createUserAndAuthenticate({
        ...form,
        UserId: form.Email   // or whatever unique ID you use
      });

      // 2) now create the patient chart with that valid token
      await createChart({
        FirstName: form.FirstName,
        LastName:  form.LastName,
        PhoneNo:   form.PhoneNo,
        Email:     form.Email,
        UserId:    form.Email
      });

      // 3) success → next screen
      navigation.replace('PatientRegistration');
    } catch (err) {
      Alert.alert('Signup failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={form.FirstName}
        onChangeText={update('FirstName')}
      />
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={form.LastName}
        onChangeText={update('LastName')}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone No"
        value={form.PhoneNo}
        onChangeText={update('PhoneNo')}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={form.Email}
        onChangeText={update('Email')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={form.Password}
        onChangeText={update('Password')}
        secureTextEntry
      />
      <Button
        title="Sign Up"
        onPress={onSignup}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
});
