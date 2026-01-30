// frontend/navigation/index.js
import React, { useState, useRef, useEffect } from 'react';
import { Alert, AppState, View } from 'react-native';
import { NavigationContainer, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getProgress, clearProgress, setProgress as setLocalProgress } from '../services/localProgress';
import { getPatient, getAppointments, setAuthToken } from '../services/authService';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import PatientInfoScreen from '../screens/PatientInfoScreen';
import InitialConsultationScreen from '../screens/InitialConsultationScreen';
import AppointmentBookingScreen from '../screens/AppointmentBookingScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import ConfirmAppointmentScreen from '../screens/ConfirmAppointmentScreen';
import TeamScreen from '../screens/TeamScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import SettingsMenuScreen from '../screens/SettingsMenuScreen';
import PasswordManagerScreen from '../screens/PasswordManagerScreen';
import ConsentFormScreen from '../screens/ConsentFormScreen';
import ForgotPasswordPhoneScreen from '../screens/ForgotPasswordPhoneScreen';
import ForgotPasswordOtpScreen from '../screens/ForgotPasswordOtpScreen';
import ForgotPasswordNewPasswordScreen from '../screens/ForgotPasswordNewPasswordScreen';
import ContactUsScreen from '../screens/ContactUsScreen';

const IDLE_TIMEOUT = 5 * 60 * 1000;
const WARNING_BEFORE = 30 * 1000;

const AuthStack = createNativeStackNavigator();
function AuthNavigator({ onLogin, onSignup }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login">{props => <LoginScreen {...props} onSignIn={onLogin} />}</AuthStack.Screen>
      <AuthStack.Screen name="ForgotPasswordPhone" component={ForgotPasswordPhoneScreen} />
      <AuthStack.Screen name="ForgotPasswordOTP" component={ForgotPasswordOtpScreen} />
      <AuthStack.Screen name="ForgotPasswordNewPassword" component={ForgotPasswordNewPasswordScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="PatientInfo">{props => <PatientInfoScreen {...props} onSignUp={onSignup} />}</AuthStack.Screen>
      <AuthStack.Screen name="ConsentForm" component={ConsentFormScreen} />
    </AuthStack.Navigator>
  );
}

const Drawer = createDrawerNavigator();
function CustomDrawerContent({ navigation, signOut }) {
  const { t } = useTranslation();
  return (
    <DrawerContentScrollView>
      <DrawerItem
        label={t('appointments.title')}
        icon={() => <Ionicons name="list-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('Appointments')}
      />
      <DrawerItem
        label={t('team.title')}
        icon={() => <Ionicons name="people-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('Team')}
      />
      <DrawerItem
        label={t('profile.title')}
        icon={() => <Ionicons name="person-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('Profile')}
      />
      <DrawerItem
        label={t('privacy.title')}
        icon={() => <Ionicons name="lock-closed-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('PrivacyPolicy')}
      />
      <DrawerItem
        label={t('settings.title')}
        icon={() => <Ionicons name="settings-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('SettingsMenu')}
      />
      <DrawerItem
        label={t('settings.password_manager')}
        icon={() => <Ionicons name="key-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('PasswordManager')}
      />
      <DrawerItem
        label={t('contact_us.title')}
        icon={() => <Ionicons name="call-outline" size={20} color="#2A7D8F" />}
        onPress={() => navigation.navigate('ContactUs')}
      />
      <DrawerItem
        label={t('logout')}
        icon={() => <Ionicons name="exit-outline" size={20} color="#2A7D8F" />}
        onPress={() =>
          Alert.alert(
            t('logout_confirm_title'),
            t('logout_confirm_message'),
            [
              { text: t('cancel'), style: 'cancel' },
              { text: t('logout'), style: 'destructive', onPress: () => signOut(false) }
            ]
          )
        }
      />
    </DrawerContentScrollView>
  );
}

function AppDrawer({ initialRoute, signOut, onSignup }) {
  const { t } = useTranslation();
  return (
    <Drawer.Navigator
      initialRouteName={initialRoute.name}
      drawerContent={props => <CustomDrawerContent {...props} signOut={signOut} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTitleAlign: 'center',
        headerLeft: () => (
          <Ionicons
            name="menu"
            size={28}
            color="#2A7D8F"
            style={{ marginLeft: 16 }}
            onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          />
        ),
      })}
    >
      {/* Initial Consultation fixed to original screen */}
      <Drawer.Screen
        name="InitialConsultation"
        component={InitialConsultationScreen}
        options={{ title: t('initial_consultation.title') }}
        initialParams={initialRoute.params}
      />

      <Drawer.Screen name="Appointments" component={AppointmentsScreen} options={{ title: t('appointments.title') }} />
      <Drawer.Screen name="Team" component={TeamScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Drawer.Screen name="SettingsMenu" component={SettingsMenuScreen} />
      <Drawer.Screen name="PasswordManager" component={PasswordManagerScreen} />
      <Drawer.Screen name="ContactUs" component={ContactUsScreen} options={{ title: t('contact_us.title') }} />
      {/* hidden */}
      <Drawer.Screen name="Confirm" component={ConfirmAppointmentScreen} options={{ drawerItemStyle: { height: 0 } }} />
      <Drawer.Screen name="PatientInfo" options={{ drawerItemStyle: { height: 0 } }}>
        {props => <PatientInfoScreen {...props} onSignUp={onSignup} />}
      </Drawer.Screen>
      <Drawer.Screen name="ConsentForm" component={ConsentFormScreen} options={{ drawerItemStyle: { height: 0 }, title: 'Consent' }} />
      <Drawer.Screen name="AppointmentBooking" component={AppointmentBookingScreen} options={{ drawerItemStyle: { height: 0 } }} />
    </Drawer.Navigator>
  );
}

export default function RootNavigation() {
  const [signedIn, setSignedIn] = useState(false);
  const timerRef = useRef(null);
  const warningRef = useRef(null);
  const navigationRef = useRef();
  const routeNameRef = useRef();
  const [initialRoute, setInitialRoute] = useState({ name: 'Appointments', params: {} });

  const getWarningMessage = () => {
    const route = routeNameRef.current;
    if (signedIn) {
      if (route === 'InitialConsultation') return `You will be returned to the login screen in ${WARNING_BEFORE / 1000} seconds if no activity is detected.`;
      return `You will be logged out in ${WARNING_BEFORE / 1000} seconds if no activity is detected.`;
    } else if (route === 'Register' || route === 'PatientInfo') {
      return `You will be returned to the start screen in ${WARNING_BEFORE / 1000} seconds if no activity is detected.`;
    }
    return null;
  };

  const performIdleAction = async () => {
    const route = routeNameRef.current;
    if (signedIn) {
      await handleSignOut(false);
      if (route === 'InitialConsultation') navigationRef.current?.navigate('Login');
    } else if (route === 'Register' || route === 'PatientInfo') {
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  const startIdleTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    timerRef.current = setTimeout(performIdleAction, IDLE_TIMEOUT);
    const message = getWarningMessage();
    if (message) {
      warningRef.current = setTimeout(() => Alert.alert('Inactivity', message), IDLE_TIMEOUT - WARNING_BEFORE);
    }
  };

  const handleActivity = () => {
    const route = routeNameRef.current;
    if (signedIn || route === 'Register' || route === 'PatientInfo') startIdleTimer();
  };

  const handleLogin = async (keyFromLogin) => {
    console.log('[navigation] handleLogin', { keyFromLogin });
    let patientKey = keyFromLogin;
    if (patientKey) await AsyncStorage.setItem('patientKey', String(patientKey));
    else {
      const stored = await AsyncStorage.getItem('patientKey');
      patientKey = stored ? Number(stored) : null;
      if (!patientKey) await AsyncStorage.removeItem('patientKey');
    }

    let hasPatient = false, progress = 0;
    if (patientKey) {
      try { await getPatient(patientKey); hasPatient = true; progress = await getProgress(); if (progress < 2) await setLocalProgress(2); }
      catch { hasPatient = false; }
    }

    let hasAppts = false;
    if (hasPatient) {
      try { const appts = await getAppointments({ patientKey }); hasAppts = Array.isArray(appts) && appts.length > 0; }
      catch (e) { console.warn('Could not fetch appointments on login:', e); }
    }

    let next;
    if (!hasPatient) next = 'PatientInfo';
    else if (hasAppts) next = 'Appointments';
    else if (progress < 3) next = 'InitialConsultation';
    else next = 'Appointments';

    setInitialRoute({ name: next, params: { patientKey } });
    console.log('[navigation] set initial route', next);
    setSignedIn(true);
    startIdleTimer();
  };

  const handleSignup = async (patientKey) => {
    console.log('[navigation] handleSignup', patientKey);
    await AsyncStorage.setItem('patientKey', String(patientKey));
    setInitialRoute({ name: 'InitialConsultation', params: { patientKey } });
    console.log('[navigation] set initial route InitialConsultation');
    setSignedIn(true);
    startIdleTimer();
  };

  const handleSignOut = async (clearData = true) => {
    console.log('[navigation] handleSignOut', { clearData });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (clearData) {
      const progress = await getProgress();
      if (progress >= 3) { await AsyncStorage.removeItem('patientKey'); await clearProgress(); }
    }
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('authUserId');
    try { await SecureStore.deleteItemAsync('sessionToken'); } catch {}
    setAuthToken(null);
    setSignedIn(false);
    console.log('[navigation] signed out');
  };

  useEffect(() => {
    if (signedIn) startIdleTimer();
    else {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    }
  }, [signedIn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') handleActivity(); });
    return () => sub.remove();
  }, []);

  const handleStateChange = () => {
    routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
    handleActivity();
  };

  return (
    <View style={{ flex: 1 }} onTouchStart={handleActivity}>
      <NavigationContainer ref={navigationRef} onStateChange={handleStateChange}>
        {signedIn ? (
          <AppDrawer initialRoute={initialRoute} signOut={handleSignOut} onSignup={handleSignup} />
        ) : (
          <AuthNavigator onLogin={handleLogin} onSignup={handleSignup} />
        )}
      </NavigationContainer>
    </View>
  );
}
