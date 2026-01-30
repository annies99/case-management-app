// frontend/screens/ConsentFormScreen.js

import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SignaturePad from '../components/SignaturePad';
import { buildConsentHtml } from '../services/consentTemplate';

function normalizeDataUrl(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, '');
  return cleaned.startsWith('data:image') ? cleaned : `data:image/png;base64,${cleaned}`;
}

export default function ConsentFormScreen({ route, navigation }) {
  const { prefill = {} } = route.params || {};

  const [name, setName] = useState(prefill.name || '');
  const [dob, setDob] = useState(prefill.dob || '');
  const [address, setAddress] = useState(prefill.address || '');
  const [phone, setPhone] = useState(prefill.phone || '');
  const [email, setEmail] = useState(prefill.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [signatureError, setSignatureError] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const signatureRef = useRef(null);
  const signedAt = useMemo(() => new Date(), []);

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignatureError(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing information', 'Please confirm the patient name before submitting.');
      return;
    }
    if (signatureRef.current?.isEmpty()) {
      setSignatureError(true);
      Alert.alert('Signature required', 'Please capture a signature before submitting the consent form.');
      return;
    }

    try {
      setSubmitting(true);
      const signatureData = await signatureRef.current.toDataURL();
      const html = buildConsentHtml({
        patient: {
          name: name.trim(),
          dob: dob.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
        },
        signatureDataUrl: normalizeDataUrl(signatureData),
        signedAtISO: signedAt.toISOString(),
      });

      navigation.navigate({
        name: route.params?.returnTo || 'PatientInfo',
        params: { consentHtml: html },
        merge: true,
      });
    } catch (error) {
      console.error('ConsentFormScreen submit failed', error);
      Alert.alert(
        'Unable to capture consent',
        error?.message || 'An unexpected error occurred while preparing the consent document. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isSigning}
      >
        <Text style={styles.title}>Patient Care Coordination Consent</Text>

        <Text style={styles.sectionTitle}>Confirm Patient Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date of Birth</Text>
          <TextInput
            style={styles.input}
            value={dob}
            onChangeText={setDob}
            placeholder="YYYY-MM-DD"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={address}
            onChangeText={setAddress}
            placeholder="Street, City, State ZIP"
            multiline
          />
        </View>
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flexItem]}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
          </View>
          <View style={[styles.inputGroup, styles.flexItem]}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Consent Summary</Text>
        <Text style={styles.paragraph}>
          Northwestern Medicine Palos Hospital, in collaboration with Labor Force, offers care coordination services to assist
          patients who have experienced accidental injuries. Participation is voluntary. By signing below you authorize Labor
          Force to contact you after discharge, help coordinate follow-up care, and assist with documentation sharing related to
          your ongoing treatment.
        </Text>
        <Text style={styles.paragraph}>
          Your decision will not affect the emergency treatment you receive. Your information will be handled according to HIPAA
          guidelines and only shared with providers involved in your care. You may withdraw consent at any time by contacting
          Labor Force at 866-572-1447.
        </Text>

        <Text style={styles.sectionTitle}>Signature</Text>
        <Text style={styles.signatureHint}>Sign inside the box using your finger or a stylus.</Text>
        <SignaturePad
          ref={signatureRef}
          style={styles.signaturePad}
          onBegin={() => setIsSigning(true)}
          onEnd={() => setIsSigning(false)}
        />
        {signatureError && <Text style={styles.errorText}>Signature is required.</Text>}

        <TouchableOpacity style={styles.secondaryButton} onPress={handleClearSignature}>
          <Text style={styles.secondaryButtonText}>Clear signature</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Agree &amp; Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2A7D8F',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2A7D8F',
    marginTop: 16,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f9f9f9',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexItem: {
    flex: 1,
  },
  paragraph: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
  },
  signatureHint: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  signaturePad: {
    height: 180,
  },
  errorText: {
    color: '#B00020',
    marginTop: 6,
  },
  secondaryButton: {
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2A7D8F',
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2A7D8F',
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2A7D8F',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

