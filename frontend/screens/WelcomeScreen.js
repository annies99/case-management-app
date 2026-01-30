// frontend/screens/WelcomeScreen.js

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';

export default function WelcomeScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const animValues = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(animValues[0], {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(animValues[1], {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animatedStyle = anim => ({
    width: '80%',
    marginTop: 12,
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    }],
  });

  const changeLang = code => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  return (
    <View style={styles.container}>
      {/* language dropdown */}
      <TouchableOpacity
        style={styles.langToggle}
        onPress={() => setShowLangMenu(v => !v)}
      >
        <Text style={styles.langText}>{i18n.language.toUpperCase()}</Text>
      </TouchableOpacity>

      {showLangMenu && (
        <View style={styles.dropdown}>
          {['en','es','pl'].map(code => (
            <TouchableOpacity
              key={code}
              style={styles.dropdownItem}
              onPress={() => changeLang(code)}
            >
              <Text style={styles.dropdownText}>{code.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
        />
      </View>

      <Text style={styles.bodyText}>{t('welcome_description')}</Text>

      <Animated.View style={animatedStyle(animValues[0])}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#4A6C82' }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>{t('login.title')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={animatedStyle(animValues[1])}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#AEDAE9' }]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.buttonText}>{t('signup')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langToggle: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#AEDAE9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    zIndex: 10,
  },
  langText: {
    fontWeight: 'bold',
    color: '#333',
  },
  dropdown: {
    position: 'absolute',
    top: 90,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,       // Android shadow
    shadowColor: '#000',// iOS shadow
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownText: {
    fontSize: 16,
    color: '#2A7D8F',
  },
  logoContainer: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 250,
    height: 250,
    resizeMode: 'contain',
  },
  bodyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 25,
  },
  buttonText: {
    textAlign: 'center',
    color: '#FFF',
    fontSize: 16,
  },
});