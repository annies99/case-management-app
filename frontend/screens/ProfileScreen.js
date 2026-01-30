// frontend/screens/ProfileScreen.js

import React, { useState, useEffect } from 'react';
import {
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { getPatientProfile, updateUserProfile } from '../services/authService';
import SimpleDatePickerModal from '../components/SimpleDatePickerModal';

const isValidDate = value => (
  !!value && typeof value.getTime === 'function' && !Number.isNaN(value.getTime())
);
const cloneDate = value => (
  isValidDate(value) ? new Date(value.getTime()) : null
);

const parseStoredDate = value => {
  if (isValidDate(value)) return cloneDate(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    return isValidDate(fromNumber) ? cloneDate(fromNumber) : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const candidate = new Date(year, month - 1, day);
      if (isValidDate(candidate)) {
        return cloneDate(candidate);
      }
    }
  }
  const fallback = new Date(trimmed);
  return isValidDate(fallback) ? cloneDate(fallback) : null;
};

const formatDateOnly = value => {
  const date = parseStoredDate(value);
  if (!isValidDate(date)) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [birthDateString, setBirthDateString] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobDraft, setDobDraft] = useState(null);
  const [phone,     setPhone]     = useState('');
  const [address1,  setAddress1]  = useState('');
  const [city,      setCity]      = useState('');
  const [stateField,setStateField]= useState('');
  const [zip,       setZip]       = useState('');
  const [patientKey,setPatientKey]= useState(null);
  const [userId,    setUserId]    = useState('');

  const birthDate = parseStoredDate(birthDateString);

  // for state dropdown
  const STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  ];
  const openState = () => {
    if (Platform.OS === 'ios') {
      const options = [...STATES, t('cancel')];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length-1 },
        idx => { if (idx < STATES.length) setStateField(STATES[idx]); }
      );
    }
  };

  // mask phone
  const fmtPhone = txt => {
    const d = txt.replace(/\D/g, '').slice(0,10);
    if (d.length > 6) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`;
    return d;
  };

  useEffect(() => {
    (async () => {
      try {
        const pk = await AsyncStorage.getItem('patientKey');
        const uid = await AsyncStorage.getItem('authUserId');
        if (!pk || !uid) throw new Error('Missing keys');
        setPatientKey(pk);
        setUserId(uid);

        const p = await getPatientProfile(pk);
        setFirstName(p.FirstName || '');
        setLastName(p.LastName || '');
        let resolvedBirthDate = null;
        if (p.BirthDate) {
          const fromProfile = parseStoredDate(p.BirthDate);
          if (fromProfile) {
            resolvedBirthDate = fromProfile;
          }
        }
        const storedDob = await AsyncStorage.getItem('patientDob');
        if (storedDob) {
          const storedDate = parseStoredDate(storedDob);
          if (storedDate) {
            resolvedBirthDate = storedDate;
          }
        }
        if (resolvedBirthDate) {
          const iso = formatDateOnly(resolvedBirthDate);
          if (iso) {
            setBirthDateString(iso);
          }
        }
        setPhone(fmtPhone(p.Phone || ''));
        setAddress1(p.Address1 || '');
        setCity(p.City || '');
        setStateField(p.State || '');
        setZip(p.Zip || '');
      } catch (err) {
        console.warn('Profile load failed', err);
      }
    })();
  }, []);

  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      return Alert.alert(t('error'), 'First and last name are required');
    }
    if (!birthDateString) {
      return Alert.alert(t('error'), 'Date of birth is required');
    }
    try {
      setUpdating(true);
      const rawPhone = phone.replace(/\D/g, '');
      await updateUserProfile({
        userId,                  // required by /user/update
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        phone:     rawPhone,     // will be sent as PhoneNo
      });
      if (birthDateString) {
        await AsyncStorage.setItem('patientDob', birthDateString);
      }
      Alert.alert('Success', 'Profile updated');
      navigation.navigate('Appointments');
    } catch (err) {
      console.error('Profile update failed', err);
      Alert.alert(t('error'), err.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex:1 }}
      behavior={Platform.OS==='ios'?'padding':'height'}
    >
      <SafeAreaView style={styles.wrapper}>
        <View style={styles.header}>
          <Ionicons
            name="chevron-back"
            size={28}
            color="#2A7D8F"
            onPress={() => navigation.navigate('Appointments')}
          />
          <Text style={styles.title}>{t('profile.title')}</Text>
          <View style={{ width:28 }}/>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('profile.full_name')}</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t('profile.full_name')}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('profile.full_name')}
              />
            </View>
          </View>

          {/* DOB */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('profile.dob')}</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                const today = new Date();
                const fallback = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
                const initial = birthDate || fallback;
                setDobDraft(initial);
                setShowDobPicker(true);
              }}
            >
              <Text style={{ color: birthDate?'#000':'#999' }}>
                {birthDate
                  ? birthDate.toLocaleDateString()
                  : t('profile.dob_placeholder')}
              </Text>
            </TouchableOpacity>
            <SimpleDatePickerModal
              visible={showDobPicker}
              initialDate={dobDraft || birthDate || new Date()}
              minimumDate={new Date(1900, 0, 1)}
              maximumDate={new Date()}
              title={t('profile.dob')}
              cancelLabel={t('cancel')}
              confirmLabel={t('confirm')}
              monthLabel={t('date_picker.month', 'Month')}
              dayLabel={t('date_picker.day', 'Day')}
              yearLabel={t('date_picker.year', 'Year')}
              onCancel={() => {
                setShowDobPicker(false);
                setDobDraft(null);
              }}
              onConfirm={nextDate => {
                const iso = formatDateOnly(nextDate);
                if (iso) {
                  setBirthDateString(iso);
                }
                setDobDraft(nextDate);
                setShowDobPicker(false);
              }}
            />
          </View>

          {/* Phone (read-only) */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('profile.phone_number')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              editable={false}
            />
          </View>

          {/* Address */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('patient_info.address')}</Text>
            <TextInput
              style={styles.input}
              value={address1}
              onChangeText={setAddress1}
            />
          </View>

          {/* City */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('patient_info.city')}</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
            />
          </View>

          {/* State */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('patient_info.state')}</Text>
            <TouchableOpacity style={styles.input} onPress={openState}>
              <Text style={{ color: stateField?'#000':'#999' }}>
                {stateField || t('patient_info.state')}
              </Text>
            </TouchableOpacity>
            {Platform.OS==='android' && (
              <View style={styles.pickerOverlay}>
                <Ionicons name="caret-down-outline" size={16} color="#2A7D8F" style={{ position:'absolute', right:16, top:16 }}/>
                <Picker
                  selectedValue={stateField}
                  onValueChange={setStateField}
                  style={styles.hiddenPicker}
                >
                  <Picker.Item label={t('patient_info.state')} value="" />
                  {STATES.map(s=> <Picker.Item key={s} label={s} value={s}/> )}
                </Picker>
              </View>
            )}
          </View>

          {/* ZIP */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('patient_info.zip')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={zip}
              onChangeText={setZip}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleUpdate}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('profile.update_button')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper:     { flex:1, backgroundColor:'#fff' },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:20 },
  title:       { flex:1, textAlign:'center', fontSize:20, color:'#2A7D8F', fontWeight:'600' },
  body:        { padding:20, paddingBottom:40 },
  field:       { marginBottom:20 },
  label:       { color:'#2A7D8F', marginBottom:6 },
  nameRow:     { flexDirection:'row', justifyContent:'space-between' },
  halfInput:   { width:'48%' },
  input:       { backgroundColor:'#AEDAE9', borderRadius:25, paddingHorizontal:16, height:50, justifyContent:'center' },
  button:      { backgroundColor:'#4A6C82', borderRadius:25, paddingVertical:14, alignItems:'center', marginTop:10 },
  buttonText:  { color:'#fff', fontSize:16 },
  pickerOverlay: { position:'relative', marginBottom:16 },
  hiddenPicker:  { position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0 },
});
