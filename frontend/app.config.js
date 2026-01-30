import 'dotenv/config';

export default {
  expo: {
    name: 'Injury Care Team',
    slug: 'injury-care-team',
    version: '1.4.3',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'light',
    /**
     * Expo enables the new architecture (Fabric/TurboModules) opt-in per-app. We initially
     * enabled it globally, however react-native-webview still has stability issues on iOS when
     * running in release mode with Fabric. On TestFlight builds the consent form rendered inside
     * the WebView was blank, blocking registration, while it worked correctly in Expo Go (which
     * does not use the new architecture yet). Disabling it keeps the runtime aligned with Expo Go
     * and restores the consent form rendering on production builds.
     */
    newArchEnabled: false,

    splash: {
      image: './assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.dextersolutions.injurycareteam',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: 'com.dextersolutions.injurycareteam',
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    plugins: [
      'expo-secure-store',
  
    ], 

    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      slotApiUrl: process.env.SLOT_API_URL,
      firstAvailableSlotsApiUrl: process.env.FIRST_AVAILABLE_SLOTS_API_URL,
      widgetApiUrl: process.env.WIDGET_API_URL,
      locationApiUrl: process.env.LOCATION_API_URL,
      internalApiUrl: process.env.INTERNAL_API_URL,
      externalAppSecret: process.env.EXTERNAL_APP_SECRET,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      initialConsultationVariant: process.env.INITIAL_CONSULTATION_VARIANT,
      eas: {
        projectId: '7b28c0ad-d58a-477d-be75-ae72832a413c',
      },
    },

    updates: {
      url: 'https://u.expo.dev/7b28c0ad-d58a-477d-be75-ae72832a413c',
    },
    runtimeVersion: '1.4.3'
    
  },
};
