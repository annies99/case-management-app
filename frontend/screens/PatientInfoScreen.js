// frontend/screens/PatientInfoScreen.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActionSheetIOS,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { createChart, getSources, addReferral } from '../services/authService';
import { setProgress as setLocalProgress } from '../services/localProgress';
import { uploadConsentHTML } from '../services/consentService';
import GooglePlacesTextInput from 'react-native-google-places-textinput';
import { GOOGLE_MAPS_API_KEY } from '../config/constants';
import SimpleDatePickerModal from '../components/SimpleDatePickerModal';

const isValidDate = value => (
  !!value && typeof value.getTime === 'function' && !Number.isNaN(value.getTime())
);

const cloneDate = value => (
  isValidDate(value) ? new Date(value.getTime()) : null
);

const formatDateOnly = (value) => {
  const date = isValidDate(value) ? value : parseStoredDate(value);
  if (!isValidDate(date)) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStoredDate = (value) => {
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
    const [, yearStr, monthStr, dayStr] = match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      const candidate = new Date(year, month - 1, day);
      if (isValidDate(candidate)) {
        return cloneDate(candidate);
      }
    }
  }

  const fallback = new Date(trimmed);
  return isValidDate(fallback) ? cloneDate(fallback) : null;
};

const formatCompactDate = (value) => {
  const formatted = formatDateOnly(value);
  return formatted ? formatted.replace(/-/g, '') : '';
};

const VirtualizedScrollView = React.forwardRef(({ children, ...props }, ref) => (
  <FlatList
    ref={ref}
    data={[]}
    keyExtractor={() => 'key'}
    renderItem={null}
    ListHeaderComponent={<>{children}</>}
    {...props}
  />
));

const normalizeMiddleInitial = value => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, '');
  if (!lettersOnly) return '';
  return lettersOnly[0].toUpperCase();
};

export default function PatientInfoScreen({ navigation, route, onSignUp }) {
  const { t, i18n } = useTranslation();
  const {
    phone: initPhone = '',
    firstName: initFirst = '',
    lastName: initLast = '',
  } = (route && route.params) || {};

  // format phone as XXX-XXX-XXXX
  const fmtPhone = txt => {
    const d = txt?.replace(/\D/g, '').slice(0, 10) || '';
    if (d.length > 6) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0,3)}-${d.slice(3)}`;
    return d;
  };

  // Dropdown lists
  const [agentList, setAgentList]               = useState([]);
  const [selectedAgent, setSelectedAgent]       = useState('');
  const [hospitalList, setHospitalList]         = useState([]);
  const [selectedHospital, setSelectedHospital] = useState('');

  // Form fields
  const [salutation, setSalutation] = useState('');
  const [firstName, setFirstName]   = useState(initFirst);
  const [lastName, setLastName]     = useState(initLast);
  const [middleName, setMiddleName] = useState('');
  const [gender, setGender]         = useState('');
  const [dobString, setDobString]     = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobDraft, setDobDraft] = useState(null);
  const [phone, setPhone]           = useState(initPhone ? fmtPhone(initPhone) : '');
  const [dayPhone, setDayPhone]     = useState('');
  const [address1, setAddress1]     = useState('');
  const [address2, setAddress2]     = useState('');
  const [city, setCity]             = useState('');
  const [stateField, setStateField] = useState('');
  const [zip, setZip]               = useState('');
  const [lang]                      = useState(i18n.language === 'es' ? 'Spanish' : 'English');
  const [loading, setLoading]       = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [consentHtml, setConsentHtml] = useState(null);

  const dobDate = useMemo(() => parseStoredDate(dobString), [dobString]);

  const firstNameRef   = useRef(null);
  const lastNameRef    = useRef(null);
  const phoneRef       = useRef(null);
  const address1Ref    = useRef(null);
  const cityRef        = useRef(null);
  const zipRef         = useRef(null);
  const scrollRef      = useRef(null);

  const handleAddressSelect = place => {
    const comps = Array.isArray(place?.details?.addressComponents)
      ? place.details.addressComponents
      : [];
    const get = (type, prop = 'longText') =>
      comps.find(c => c.types?.includes(type))?.[prop] || '';
    const streetNumber = get('street_number');
    const streetName = get('route');
    const cityName = get('locality') || get('sublocality') || get('administrative_area_level_2');
    const stateCode = get('administrative_area_level_1', 'shortText');
    const zipCode = get('postal_code');
    const addrParts = [];
    if (streetNumber) addrParts.push(streetNumber);
    if (streetName) addrParts.push(streetName);
    const addr1 = addrParts.join(' ');
    setAddress1(addr1);
    setCity(cityName);
    setStateField(stateCode);
    setZip(zipCode);
  };

  // iOS ActionSheets
  const openAgent = () => {
    if (Platform.OS === 'ios') {
      const opts = agentList.map(a => a.Description).concat(t('cancel'));
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: opts.length - 1 },
        idx => idx < agentList.length && setSelectedAgent(agentList[idx].Id)
      );
    }
  };
  const openHospital = () => {
    if (Platform.OS === 'ios') {
      const opts = hospitalList.map(h => h.Description).concat(t('cancel'));
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: opts.length - 1 },
        idx => idx < hospitalList.length && setSelectedHospital(hospitalList[idx].Id)
      );
    }
  };

  // Entrance animations + fetch dropdown data
  const anims = useRef(Array.from({ length: 17 }).map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      80,
      anims.map(a => Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: true }))
    ).start();

    getSources('Agent').then(setAgentList).catch(console.error);
    getSources('Employer').then(setHospitalList).catch(console.error);
  }, []);

  // Load draft or fallback saved registration
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('registrationDraft');
        if (saved) {
          const d = JSON.parse(saved);
          if (!initFirst && d.firstName) setFirstName(d.firstName);
          if (!initLast  && d.lastName)  setLastName(d.lastName);
          if (!initPhone && d.phone)     setPhone(fmtPhone(d.phone));
          if (d.middleName) setMiddleName(normalizeMiddleInitial(d.middleName));
          if (d.gender)     setGender(d.gender);
          if (d.salutation) setSalutation(d.salutation);
          if (d.dob) {
            const dd = parseStoredDate(d.dob);
            const iso = formatDateOnly(dd);
            if (iso) setDobString(iso);
          }
          if (d.dayPhone)     setDayPhone(fmtPhone(d.dayPhone));
          if (d.address1)     setAddress1(d.address1);
          if (d.address2)     setAddress2(d.address2);
          if (d.city)         setCity(d.city);
          if (d.stateField)   setStateField(d.stateField);
          if (d.zip)          setZip(d.zip);
          if (d.selectedAgent)    setSelectedAgent(String(d.selectedAgent));
          if (d.selectedHospital) setSelectedHospital(String(d.selectedHospital));
        } else {
          if (!initFirst) {
            const v = await AsyncStorage.getItem('regFirstName');
            if (v) setFirstName(v);
          }
          if (!initLast) {
            const v = await AsyncStorage.getItem('regLastName');
            if (v) setLastName(v);
          }
          if (!initPhone) {
            const v = await AsyncStorage.getItem('regPhone');
            if (v) setPhone(fmtPhone(v));
          }
        }
      } catch (_) {}
      setDraftLoaded(true);
    })();
  }, []);

  // Persist draft on every change
  useEffect(() => {
    if (!draftLoaded) return;
    const data = {
      firstName, lastName, middleName,
      gender, salutation,
      dob: dobString || null,
      phone: phone.replace(/\D/g, ''), dayPhone: dayPhone.replace(/\D/g, ''),
      address1, address2, city, stateField, zip,
      selectedAgent, selectedHospital,
    };
    AsyncStorage.setItem('registrationDraft', JSON.stringify(data));
  }, [
    draftLoaded,
    firstName, lastName, middleName,
    gender, salutation, dobString,
    phone, dayPhone,
    address1, address2, city, stateField, zip,
    selectedAgent, selectedHospital,
  ]);

  const handleMiddleNameChange = useCallback(text => {
    setMiddleName(normalizeMiddleInitial(text));
  }, []);

  // Handle consent html param from ConsentForm screen (and restore draft if present)
  useEffect(() => {
    const unsub = navigation.addListener('focus', async () => {
      const ch = route?.params?.consentHtml;
      if (ch) {
        setConsentHtml(ch);
        await AsyncStorage.setItem('consentHtmlDraft', ch);
        navigation.setParams({ consentHtml: undefined }); // prevent re-trigger
        InteractionManager.runAfterInteractions(() => {
          scrollRef.current?.scrollToEnd({ animated: false });
        });
      } else if (!consentHtml) {
        const saved = await AsyncStorage.getItem('consentHtmlDraft');
        if (saved) setConsentHtml(saved);
      }
    });
    return unsub;
  }, [navigation, route?.params, consentHtml]);

  // Row animation helper
  const rowStyle = i => ({
    opacity: anims[i],
    transform: [{ translateY: anims[i].interpolate({ inputRange: [0,1], outputRange: [20,0] }) }],
    marginBottom: 20,
  });

  // Salutation options
  const SAL_OPS = [
    t('registration.salutation_option_mr'),
    t('registration.salutation_option_mrs'),
    t('registration.salutation_option_ms'),
    t('registration.salutation_option_dr'),
  ];
  const SAL_V = ['Mr','Mrs','Ms','Dr'];
  const openSal = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...SAL_OPS, t('cancel')], cancelButtonIndex: SAL_OPS.length },
        idx => idx < SAL_OPS.length && setSalutation(SAL_V[idx])
      );
    }
  };

  // Gender options
  const GEN_OPS = [t('registration.gender_option_male'), t('registration.gender_option_female'), t('registration.gender_option_other')];
  const GEN_V   = ['Male','Female', 'Other'];
  const openGen = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...GEN_OPS, t('cancel')], cancelButtonIndex: GEN_OPS.length },
        idx => idx < GEN_OPS.length && setGender(GEN_V[idx])
      );
    }
  };

  // State options
  const STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  ];
  const openState = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...STATES, t('cancel')], cancelButtonIndex: STATES.length },
        idx => idx < STATES.length && setStateField(STATES[idx])
      );
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    const rawPhone = phone.replace(/\D/g, '');
    const rawDay   = dayPhone.replace(/\D/g, '') || rawPhone;

    // Validation
    if (!selectedAgent) {
      return Alert.alert(t('error'), t('patient_info.error_agent_required'));
    }
    if (!selectedHospital) {
      return Alert.alert(t('error'), t('patient_info.error_hospital_required'));
    }
    if (!salutation) {
      return Alert.alert(t('error'), t('patient_info.error_salutation_required'));
    }
    if (!firstName.trim()) {
      return Alert.alert(t('error'), t('patient_info.error_first_name_required'));
    }
    if (!lastName.trim()) {
      return Alert.alert(t('error'), t('patient_info.error_last_name_required'));
    }
    if (!gender) {
      return Alert.alert(t('error'), t('patient_info.error_gender_required'));
    }
    if (!rawPhone) {
      return Alert.alert(t('error'), t('patient_info.error_phone_required'));
    }
    if (!dobString) {
      return Alert.alert(t('error'), t('patient_info.error_dob_required'));
    }
    if (!address1.trim()) {
      return Alert.alert(t('error'), t('patient_info.error_address_required'));
    }
    if (!city.trim()) {
      return Alert.alert(t('error'), t('patient_info.error_city_required'));
    }
    if (!stateField) {
      return Alert.alert(t('error'), t('patient_info.error_state_required'));
    }
    if (!zip.trim()) {
      return Alert.alert(t('error'), t('patient_info.error_zip_required'));
    }
    if (!consentHtml) {
      return Alert.alert(t('error'), 'Consent is required before completing registration.');
    }

    setLoading(true);
    try {
      const payload = {
        Agent: selectedAgent,
        Hospital: selectedHospital,
        Salutation: salutation,
        FirstName: firstName,
        LastName: lastName,
        MiddleName: middleName,
        Gender: gender,
        BirthDate: formatCompactDate(dobString),
        Phone: rawPhone,
        DaytimePhone: rawDay,
        Address1: address1,
        Address2: address2,
        City: city,
        State: stateField,
        Zip: zip,
        Email: rawPhone,
        Id: rawPhone,
        PracticeKey: 4,
        ProviderKey: 1,
        PreferredLanguage: lang,
      };

      const res = await createChart(payload);
      const patientKey = res.result?.PatientKey;
      if (!patientKey) throw new Error('Missing PatientKey in response');

      // upload signed consent HTML
      await uploadConsentHTML({
        patientKey,
        html: consentHtml,
        documentType: 'Communication',
        subject: 'Consent',
      });
      await AsyncStorage.removeItem('consentHtmlDraft');

      // Save locally
      await AsyncStorage.setItem('patientKey', String(patientKey));
      await AsyncStorage.setItem('patientName', `${firstName} ${lastName}`);
      await AsyncStorage.setItem('patientPhone', rawPhone);
      if (dobString) {
        await AsyncStorage.setItem('patientDob', dobString);
      } else {
        await AsyncStorage.removeItem('patientDob');
      }
      await AsyncStorage.multiRemove(['regFirstName','regLastName','regPhone']);
      await AsyncStorage.removeItem('registrationDraft');
      try { await setLocalProgress(2); } catch {}

      // Referrals
      if (selectedAgent) {
        const a = agentList.find(x => x.Id === selectedAgent);
        if (a) {
          await addReferral({ patientKey, referrer: { Id: a.Id, Name: a.Description, Type: 'Agent' } });
        }
      }
      if (selectedHospital) {
        const h = hospitalList.find(x => x.Id === selectedHospital);
        if (h) {
          await addReferral({ patientKey, referrer: { Id: h.Id, Name: h.Description, Type: 'Hospital' } });
        }
      }

      if (typeof onSignUp === 'function') {
        onSignUp(patientKey);
      } else {
        navigation.navigate('Appointments', { patientKey });
      }

    } catch (err) {
      console.error('PatientInfoScreen error:', err);
      Alert.alert(t('error'), err.message || t('error_unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.wrapper}>
        <VirtualizedScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={28} color="#2A7D8F" />
            </TouchableOpacity>
            <Text style={styles.title}>{t('patient_info.title')}</Text>
            <View style={{ width:28 }}/>
          </View>

          {/* Agent */}
          <Animated.View style={rowStyle(0)}>
            <Text style={styles.label}>{t('patient_info.agent')}</Text>
            <TouchableOpacity style={styles.pill} onPress={openAgent}>
              <Text style={styles.pillText}>
                {selectedAgent
                  ? agentList.find(a => a.Id === selectedAgent)?.Description
                  : t('patient_info.select_agent')}
              </Text>
              {Platform.OS==='android' && (
                <Picker selectedValue={selectedAgent} onValueChange={setSelectedAgent} style={styles.overlay}>
                  <Picker.Item label={t('patient_info.select_agent')} value="" />
                  {agentList.map(({ Id, Description }) => (
                    <Picker.Item key={Id} label={Description} value={Id} />
                  ))}
                </Picker>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Hospital */}
          <Animated.View style={rowStyle(1)}>
            <Text style={styles.label}>{t('patient_info.hospital')}</Text>
            <TouchableOpacity style={styles.pill} onPress={openHospital}>
              <Text style={styles.pillText}>
                {selectedHospital
                  ? hospitalList.find(h => h.Id === selectedHospital)?.Description
                  : t('patient_info.select_hospital')}
              </Text>
              {Platform.OS==='android' && (
                <Picker selectedValue={selectedHospital} onValueChange={setSelectedHospital} style={styles.overlay}>
                  <Picker.Item label={t('patient_info.select_hospital')} value="" />
                  {hospitalList.map(({ Id, Description }) => (
                    <Picker.Item key={Id} label={Description} value={Id} />
                  ))}
                </Picker>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Salutation */}
          <Animated.View style={rowStyle(2)}>
            <Text style={styles.label}>{t('patient_info.salutation')}</Text>
            <TouchableOpacity style={styles.pill} onPress={openSal}>
              <Text style={styles.pillText}>
                {salutation
                  ? t(`registration.salutation_option_${salutation.toLowerCase()}`)
                  : t('registration.salutation')}
              </Text>
              {Platform.OS==='android' && (
                <Picker selectedValue={salutation} onValueChange={setSalutation} style={styles.overlay}>
                  {SAL_V.map((v,i) => (
                    <Picker.Item key={v} label={SAL_OPS[i]} value={v} />
                  ))}
                </Picker>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* First Name */}
          <Animated.View style={rowStyle(3)}>
            <Text style={styles.label}>{t('patient_info.first_name')}</Text>
            <TextInput
              ref={firstNameRef}
              style={styles.pill}
              placeholder={t('patient_info.first_name_placeholder')}
              value={firstName}
              onChangeText={setFirstName}
            />
          </Animated.View>

          {/* Last Name */}
          <Animated.View style={rowStyle(4)}>
            <Text style={styles.label}>{t('patient_info.last_name')}</Text>
            <TextInput
              ref={lastNameRef}
              style={styles.pill}
              placeholder={t('patient_info.last_name_placeholder')}
              value={lastName}
              onChangeText={setLastName}
            />
          </Animated.View>

          {/* Middle Name */}
          <Animated.View style={rowStyle(5)}>
            <Text style={styles.label}>{t('patient_info.middle_name')}</Text>
            <TextInput
              style={styles.pill}
              placeholder={t('patient_info.middle_name_placeholder')}
              value={middleName}
              onChangeText={handleMiddleNameChange}
            />
          </Animated.View>

          {/* Gender */}
          <Animated.View style={rowStyle(6)}>
            <Text style={styles.label}>{t('patient_info.gender')}</Text>
            <TouchableOpacity style={styles.pill} onPress={openGen}>
              <Text style={styles.pillText}>
                {gender
                  ? t(`registration.gender_option_${gender.toLowerCase()}`)
                  : t('patient_info.gender')}
              </Text>
              {Platform.OS==='android' && (
                <Picker selectedValue={gender} onValueChange={setGender} style={styles.overlay}>
                  {GEN_V.map((v,i) => (
                    <Picker.Item key={v} label={GEN_OPS[i]} value={v} />
                  ))}
                </Picker>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Date of Birth */}
          <Animated.View style={rowStyle(7)}>
            <Text style={styles.label}>{t('patient_info.dob')}</Text>
            <TouchableOpacity
              style={styles.pill}
              onPress={() => {
                const today = new Date();
                const fallback = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
                const initial = isValidDate(dobDate) ? dobDate : fallback;
                setDobDraft(initial);
                setShowDobPicker(true);
              }}
            >
              <Text style={{ color: dobString ? '#000' : '#999' }}>
                {dobDate ? dobDate.toLocaleDateString() : t('patient_info.dob_placeholder')}
              </Text>
            </TouchableOpacity>
            <SimpleDatePickerModal
              visible={showDobPicker}
              initialDate={dobDraft || dobDate || new Date()}
              minimumDate={new Date(1900, 0, 1)}
              maximumDate={new Date()}
              title={t('patient_info.dob')}
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
                const nextIso = formatDateOnly(nextDate);
                if (nextIso) {
                  setDobString(nextIso);
                }
                setDobDraft(nextDate);
                setShowDobPicker(false);
              }}
            />
          </Animated.View>

          {/* Phone */}
          <Animated.View style={rowStyle(8)}>
            <Text style={styles.label}>{t('patient_info.phone_number')}</Text>
            <TextInput
              style={styles.pill}
              placeholder={t('patient_info.phone_number_placeholder')}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={v => setPhone(fmtPhone(v))}
            />
          </Animated.View>

          {/* Daytime Phone */}
          <Animated.View style={rowStyle(9)}>
            <Text style={styles.label}>{t('patient_info.daytime_phone')}</Text>
            <TextInput
              style={styles.pill}
              placeholder={t('patient_info.daytime_phone_placeholder')}
              keyboardType="phone-pad"
              value={dayPhone}
              onChangeText={v => setDayPhone(fmtPhone(v))}
            />
          </Animated.View>

          {/* Address 1 */}
          <Animated.View style={rowStyle(10)}>
            <Text style={styles.label}>{t('patient_info.address')}</Text>
            <GooglePlacesTextInput
              apiKey={GOOGLE_MAPS_API_KEY}
              placeHolderText={t('patient_info.address_placeholder')}
              onPlaceSelect={handleAddressSelect}
              value={address1}
              onTextChange={setAddress1}
              fetchDetails
              detailsFields={['addressComponents']}
              style={{
                input: styles.pill,
                container: { flex: 0 },
                suggestionsContainer: { backgroundColor: '#fff', zIndex: 1 },
                placeholder: { color: '#999' },
              }}
            />
          </Animated.View>

          {/* Address 2 */}
          <Animated.View style={rowStyle(11)}>
            <Text style={styles.label}>{t('patient_info.address2')}</Text>
            <TextInput
              style={styles.pill}
              placeholder={t('patient_info.address2_placeholder')}
              value={address2}
              onChangeText={setAddress2}
            />
          </Animated.View>

          {/* City */}
          <Animated.View style={rowStyle(12)}>
            <Text style={styles.label}>{t('patient_info.city')}</Text>
            <TextInput
              style={styles.pill}
              placeholder={t('patient_info.city_placeholder')}
              value={city}
              onChangeText={setCity}
            />
          </Animated.View>

          {/* State */}
          <Animated.View style={rowStyle(13)}>
            <Text style={styles.label}>{t('patient_info.state')}</Text>
            <TouchableOpacity style={styles.pill} onPress={openState}>
              <Text style={styles.pillText}>
                {stateField || t('patient_info.state_placeholder')}
              </Text>
              {Platform.OS==='android' && (
                <Picker selectedValue={stateField} onValueChange={setStateField} style={styles.overlay}>
                  <Picker.Item label={t('patient_info.state_placeholder')} value="" />
                  {STATES.map(s => (
                    <Picker.Item key={s} label={s} value={s} />
                  ))}
                </Picker>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ZIP */}
          <Animated.View style={rowStyle(14)}>
            <Text style={styles.label}>{t('patient_info.zip')}</Text>
            <TextInput
              style={styles.pill}
              placeholder={t('patient_info.zip_placeholder')}
              keyboardType="numeric"
              value={zip}
              onChangeText={setZip}
            />
          </Animated.View>

          {/* Consent (required) */}
          <Animated.View style={rowStyle(15)}>
            <Text style={styles.label}>Consent (required)</Text>
            <TouchableOpacity
              style={[styles.pill, { flexDirection:'row', alignItems:'center', justifyContent:'space-between' }]}
              onPress={() => {
                const fullName = `${firstName?.trim()||''} ${lastName?.trim()||''}`.trim();
                navigation.navigate('ConsentForm', {
                  returnTo: 'PatientInfo',
                  prefill: {
                    name: fullName,
                    dob: dobString,
                    address: `${address1||''} ${address2||''}, ${city||''}, ${stateField||''} ${zip||''}`.trim(),
                    phone: phone,
                    email: '', // add if you have it
                  },
                });
              }}
            >
              <Text style={styles.pillText}>
                {consentHtml ? 'Consent captured ✓' : 'Tap to review & sign'}
              </Text>
              <Ionicons
                name={consentHtml ? 'checkmark-circle' : 'document-text-outline'}
                size={22}
                color="#2A7D8F"
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Complete Registration */}
          <Animated.View style={rowStyle(16)}>
            <TouchableOpacity style={styles.completeBtn} onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.completeText}>{t('patient_info.complete_registration')}</Text>
              }
            </TouchableOpacity>
          </Animated.View>

        </VirtualizedScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper:      { flex:1, backgroundColor:'#fff' },
  container:    { padding:20, paddingTop:50 },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:20 },
  title:        { fontSize:24, color:'#2A7D8F', fontWeight:'600' },
  label:        { marginBottom:6, color:'#2A7D8F', fontSize:16 },
  pill:         { backgroundColor:'#AEDAE9', borderRadius:25, height:50, paddingHorizontal:16, justifyContent:'center', marginBottom:16, position:'relative' },
  pillText:     { color:'#2A7D8F' },
  overlay:      { position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0 },
  completeBtn:  { backgroundColor:'#4A6C82', borderRadius:25, paddingVertical:14, alignItems:'center', marginTop:10 },
  completeText: { color:'#fff', fontSize:16 },
});
