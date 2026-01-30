import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import PatientRegistrationScreen from '../screens/PatientRegistrationScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: t('auth.login') }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: t('auth.signup') }} />
      <Stack.Screen
        name="PatientRegistration"
        component={PatientRegistrationScreen}
        options={{ title: t('registration.title') }}
      />
    </Stack.Navigator>
  );
}
