# Case Management App

A comprehensive React Native mobile application for managing patient referrals, appointments, and case workflows. This app integrates with multiple external APIs to provide a seamless experience for healthcare case management.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Development Guide](#development-guide)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Case Management App is a mobile-first solution designed to streamline patient referral workflows, appointment scheduling, and case tracking for healthcare organizations. The app provides:

- **Patient Registration & Management**: Onboard and manage patient information securely
- **Referring Provider Integration**: Connect with external provider networks
- **Dual Appointment Booking System**: Automatically book appointments in both internal and external (IPM/EZDocs) systems
- **Appointment Scheduling**: Book appointments with available time slots from integrated systems
- **Referral Tracking**: Create and monitor patient referrals through their lifecycle
- **Smart Appointment Sorting**: View appointments chronologically with earliest dates first
- **Location Services with Directions**: Navigate to appointment locations with integrated map directions
- **Multi-language Support**: Built-in internationalization (i18n) support
- **Offline Capabilities**: Local data persistence for offline access

---

## Tech Stack

### Frontend
- **React Native** (Expo SDK 54): Cross-platform mobile framework
- **React Navigation** (v6): Navigation and routing
- **Expo**: Development platform and tooling
- **AsyncStorage**: Local data persistence
- **Axios**: HTTP client for API requests
- **i18next**: Internationalization framework
- **React Native Maps**: Google Maps integration
- **Expo Notifications**: Push notifications and reminders

### Backend APIs
- **CM Laborforce Team API**: Primary case management backend
- **EZDocs AHC Centers API**: Healthcare appointment scheduling
- **Widget API**: Additional healthcare widgets and services

### Development Tools
- **Node.js** (v16+): JavaScript runtime
- **npm/yarn**: Package management
- **Expo CLI**: Development and build tooling
- **ESLint**: Code linting
- **Prettier**: Code formatting

### Services & Integrations
- **Google Maps API**: Location services and mapping
- **Expo Push Notifications**: Mobile push notifications

---

## Architecture

### Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Native App                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Screens   │  │   Services   │  │   Components  │  │
│  │             │  │              │  │               │  │
│  │ - Login     │  │ - Auth       │  │ - Forms       │  │
│  │ - Register  │  │ - Referral   │  │ - Lists       │  │
│  │ - Booking   │  │ - Schedule   │  │ - Modals      │  │
│  │ - Team      │  │ - Provider   │  │ - Cards       │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
└────────────────────────────┼─────────────────────────────┘
                             │
                   ┌─────────▼──────────┐
                   │   API Services     │
                   │                    │
                   │ - axios instances  │
                   │ - interceptors     │
                   │ - error handling   │
                   └─────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐  ┌─────────▼────────┐  ┌────────▼────────┐
│ CM Labor     │  │ EZDocs AHC       │  │ Widget API      │
│ Force Team   │  │ Centers          │  │                 │
│              │  │                  │  │                 │
│ - Providers  │  │ - Timeslots      │  │ - Additional    │
│ - Locations  │  │ - Appointments   │  │   Services      │
│ - Referrals  │  │                  │  │                 │
│ - Schedules  │  │                  │  │                 │
└──────────────┘  └──────────────────┘  └─────────────────┘
```

### Data Flow

1. **Authentication Flow**:
   ```
   Login Screen → authService.login() → Store Token → Navigate to Dashboard
   ```

2. **Dual Appointment Booking Flow** (Version 1.1.0+):
   ```
   Select Provider → Fetch Locations → Select Location →
   Fetch Timeslots → Select Time → Confirm Appointment →
   ┌─────────────────────────────────────────────────────┐
   │  bookAppointmentTransaction (BookingService.js)     │
   │  ┌──────────────────────────────────────────────┐   │
   │  │ 1. Create Referral (Internal - cmdemo.ezdocs)│   │
   │  │    ✓ Returns ReferralKey                     │   │
   │  └──────────────────────────────────────────────┘   │
   │  ┌──────────────────────────────────────────────┐   │
   │  │ 2. Create Schedule (Internal - cmdemo.ezdocs)│   │
   │  │    ✓ Links to ReferralKey                    │   │
   │  └──────────────────────────────────────────────┘   │
   │  ┌──────────────────────────────────────────────┐   │
   │  │ 3. Book IPM Appointment (widget.ahccenters)  │   │
   │  │    ✓ Non-blocking (logs error if fails)      │   │
   │  │    ✓ Only if external keys available         │   │
   │  └──────────────────────────────────────────────┘   │
   └─────────────────────────────────────────────────────┘
   → Success Confirmation
   ```

3. **Referral Creation Flow**:
   ```
   Patient Selection → Provider Selection → Location Selection →
   Create IN-type Referral → Capture ReferralKey →
   Use for Scheduling
   ```

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v16.x or higher
  ```bash
  node --version  # Should output v16.x.x or higher
  ```

- **npm**: v7.x or higher (or yarn v1.22+)
  ```bash
  npm --version   # Should output v7.x.x or higher
  ```

- **Expo CLI**: Latest version
  ```bash
  npm install -g expo-cli
  ```

- **iOS Development** (macOS only):
  - Xcode 13+ (for iOS development)
  - iOS Simulator
  - CocoaPods: `sudo gem install cocoapods`

- **Android Development**:
  - Android Studio
  - Android SDK (API level 31+)
  - Android Emulator or physical device with USB debugging

- **Git**: For version control
  ```bash
  git --version
  ```

### Optional Tools
- **Expo Go App**: For testing on physical devices
- **React Native Debugger**: For advanced debugging
- **Postman/Insomnia**: For API testing

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/case-management-app.git
cd case-management-app
```

### 2. Install Dependencies

```bash
# Install all Node.js dependencies
npm install

# Or using yarn
yarn install
```

### 3. Install iOS Dependencies (macOS only)

```bash
cd ios
pod install
cd ..
```

### 4. Environment Setup

Create a `.env` file in the `frontend` directory:

```bash
cd frontend
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) section).

### 5. Start Development Server

```bash
# Start Expo development server
npm start

# Or using yarn
yarn start
```

### 6. Run on Device/Simulator

**iOS:**
```bash
npm run ios
# Or press 'i' in the Expo CLI
```

**Android:**
```bash
npm run android
# Or press 'a' in the Expo CLI
```

---

## Configuration

### Environment Variables

Create a `frontend/.env` file with the following variables:

```env
# ============================================
# API ENDPOINTS
# ============================================

# Primary API - CM Laborforce Team
# Used for: Providers, Locations, Referrals, Referral Schedules
API_BASE_URL=https://cm.laborforce.team/api/externalservice/cm

# Timeslots API - EZDocs AHC Centers
# Used for: Available appointment slots
SLOT_API_URL=https://ezdocs.ahccenters.com/api/externalservice/cm

# First Available Slots API (fallback uses SLOT_API_URL)
FIRST_AVAILABLE_SLOTS_API_URL=https://ezdocs.ahccenters.com/api/externalservice/cm

# Widget API
WIDGET_API_URL=https://widget.ahccenters.com/api

# Location API (same as API_BASE_URL)
LOCATION_API_URL=https://cm.laborforce.team/api/externalservice/cm

# ============================================
# AUTHENTICATION
# ============================================

# External App Secret (provided by API administrator)
EXTERNAL_APP_SECRET=your-app-secret-here

# ============================================
# INTERNAL BACKEND (if using custom backend)
# ============================================

# Internal API URL (for custom backend services)
API_URL=http://localhost:5000/api
INTERNAL_API_URL=http://localhost:5000/api
PORT=5000

# ============================================
# EXTERNAL SERVICES
# ============================================

# Google Maps API Key
# Get your key from: https://console.cloud.google.com/
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# ============================================
# FEATURE FLAGS
# ============================================

# Initial Consultation Variant (v1 or v2)
INITIAL_CONSULTATION_VARIANT=v1
```

### Expo Configuration

Edit `app.config.js` to pass environment variables to the app:

```javascript
export default {
  expo: {
    name: "Case Management App",
    slug: "case-management-app",
    version: "1.0.0",
    // ... other config
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      slotApiUrl: process.env.SLOT_API_URL,
      externalAppSecret: process.env.EXTERNAL_APP_SECRET,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      // ... other variables
    }
  }
}
```

---

## API Documentation

### Overview

The app integrates with three main API systems:

1. **CM Laborforce Team API** (`cm.laborforce.team`)
2. **EZDocs AHC Centers API** (`ezdocs.ahccenters.com`)
3. **Widget API** (`widget.ahccenters.com`)

### Authentication

All APIs require authentication headers:

```javascript
headers: {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'AppSecret': '<YOUR_APP_SECRET>',
  'Token': '<USER_AUTH_TOKEN>'  // From login response
}
```

**Note**: The Timeslots API (EZDocs) requires **only AppSecret**, not Token.

### API Endpoints

#### 1. Referring Providers API

**Endpoint**: `GET /refferingprovider/list`

**Base URL**: `https://cm.laborforce.team/api/externalservice/cm`

**Purpose**: Fetch list of referring providers with external IDs

**Parameters**:
- `externalKey` (optional): `"true"` to filter providers with non-null ExternalID

**Headers**:
```
Accept: application/json
AppSecret: <YOUR_APP_SECRET>
Token: <AUTH_TOKEN>
```

**Response**:
```json
{
  "success": true,
  "message": "Success",
  "result": [
    {
      "ProviderKey": 42,
      "ProviderName": "Dr. Jane Smith, MD",
      "ExternalId": "1302",
      "Specialty": "Cardiology",
      "Phone": "555-0100"
    }
  ]
}
```

**Implementation**:
```javascript
import { fetchReferringProviders } from './services/referringProviderService';

const providers = await fetchReferringProviders({ externalKeyOnly: true });
```

---

#### 2. Referring Provider Locations API

**Endpoint**: `GET /refferingprovider/locations`

**Base URL**: `https://cm.laborforce.team/api/externalservice/cm`

**Purpose**: Fetch locations associated with a referring provider

**Parameters**:
- `refferingProviderKey` (required): The ProviderKey from the provider list

**Headers**:
```
Accept: application/json
AppSecret: <YOUR_APP_SECRET>
Token: <AUTH_TOKEN>
```

**Response**:
```json
{
  "success": true,
  "result": [
    {
      "LocationKey": 66,
      "LocationDescription": "Main Office - Chicago",
      "ExternalIPMKey": "86",
      "Address1": "123 Medical Plaza",
      "City": "Chicago",
      "State": "IL",
      "Zip": "60601",
      "Phone": "555-0200"
    }
  ]
}
```

**Implementation**:
```javascript
import { fetchReferringProviderLocations } from './services/referringProviderService';

const locations = await fetchReferringProviderLocations(providerKey);
```

---

#### 3. Available Timeslots API

**Endpoint**: `GET /appointment/getavailableslots`

**Base URL**: `https://ezdocs.ahccenters.com/api/externalservice/cm`

**Purpose**: Fetch available appointment time slots

**Parameters**:
- `locationKey` (required): Location's ExternalIPMKey
- `providerKey` (required): Provider's ExternalId
- `fromDate` (required): Start date (YYYYMMDD format)
- `toDate` (required): End date (YYYYMMDD format)
- `slotSize` (optional): Slot size in minutes (default: "15")
- `slotDuration` (optional): Appointment duration in minutes (default: "30")
- `practiceKey` (optional): Practice identifier (default: "1")

**Headers**:
```
Accept: application/json
AppSecret: <YOUR_APP_SECRET>
```

**Note**: This endpoint does **NOT** require the Token header.

**Response**:
```json
{
  "success": true,
  "result": [
    {
      "Date": "20260115",
      "Time": "0900",
      "DateTime": "2026-01-15T09:00:00",
      "Available": true
    }
  ]
}
```

**Implementation**: See `InitialConsultationScreen.js` lines 1250-1350

---

#### 4. Add Referral API

**Endpoint**: `POST /referrals/add`

**Base URL**: `https://cm.laborforce.team/api/externalservice/cm`

**Purpose**: Create a new patient referral

**Headers**:
```
Accept: application/json
Content-Type: application/json
AppSecret: <YOUR_APP_SECRET>
Token: <AUTH_TOKEN>
```

**Request Body**:
```json
{
  "PatientKey": 6747,
  "ReferredBy": {
    "Id": 42,
    "Name": "Dr. Jane Smith, MD",
    "Type": "Provider",
    "ExternalID": "1302"
  },
  "ReferralDate": "2026-01-03T00:00:00",
  "EncounterKey": 0,
  "ReferralType": "In",
  "NextScheduledDate": "",
  "Comments": "Main Office - Chicago - 123 Medical Plaza, Chicago, IL, 60601"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Success",
  "result": {
    "ReferalKey": 15335,
    "PatientKey": 6747,
    "ReferredBy": { ... },
    "Comments": "...",
    "ReferralDate": "2026-01-03T00:00:00",
    "ReferralType": "In"
  }
}
```

**Important Note**: The API response contains a typo - it returns `ReferalKey` (one 'r') instead of `ReferralKey`.

**Implementation**:
```javascript
import { addReferral } from './services/authService';

const response = await addReferral({
  patientKey: 6747,
  referrer: {
    Id: 42,
    Name: "Dr. Jane Smith, MD",
    Type: "Provider",
    ExternalID: "1302"
  },
  comments: "Location details..."
});

// Extract ReferralKey (note the typo handling)
const referralKey = response.result.ReferalKey || response.result.ReferralKey;
```

---

#### 5. Add Referral Schedule API

**Endpoint**: `POST /referralschedules/add`

**Base URL**: `https://cm.laborforce.team/api/externalservice/cm`

**Purpose**: Create an appointment schedule linked to a referral

**Headers**:
```
Accept: application/json
Content-Type: application/json
AppSecret: <YOUR_APP_SECRET>
Token: <AUTH_TOKEN>
```

**Request Body**:
```json
{
  "ReferralKey": 15335,
  "PatientKey": 6747,
  "StartDateTime": "2026-01-15T09:00:00",
  "EndDateTime": "2026-01-15T09:45:00",
  "Status": "Open",
  "Comments": ""
}
```

**Response**:
```json
{
  "success": true,
  "message": "Schedule created successfully",
  "result": {
    "ReferralScheduleKey": 5001,
    "ReferralKey": 15335,
    "PatientKey": 6747,
    "StartDateTime": "2026-01-15T09:00:00",
    "EndDateTime": "2026-01-15T09:45:00",
    "Status": "Open"
  }
}
```

**Implementation**:
```javascript
import { addReferralSchedule } from './services/referralScheduleService';

const schedule = await addReferralSchedule({
  ReferralKey: 15335,
  PatientKey: 6747,
  StartDateTime: "2026-01-15T09:00:00",
  EndDateTime: "2026-01-15T09:45:00",
  Status: "Open",
  Comments: ""
});
```

---

#### 6. IPM/EZDocs Appointment Booking API (Version 1.1.0+)

**Endpoint**: `POST /appointment/book-appointment`

**Base URL**: `https://widget.ahccenters.com/api`

**Purpose**: Book appointments directly on the IPM/EZDocs external system

**Headers**:
```
Accept: application/json
Content-Type: application/json
```

**Note**: This endpoint does **NOT** require AppSecret or Token authentication.

**Request Body**:
```json
{
  "practiceKey": "1",
  "providerKey": "1302",
  "locationKey": "86",
  "visitTypeKey": "355",
  "appointmentDate": "01/15/2026",
  "appointmentTime": "9:00 AM",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "01/01/1990",
  "email": null,
  "phone": "5555551234",
  "comments": "Initial Consult LABORFORCE",
  "notificationPreference": "Cell"
}
```

**Required Parameters**:
- `practiceKey`: Always `"1"` for this integration
- `providerKey`: Provider's External IPM Key (from `provider.ExternalIPMKey`)
- `locationKey`: Location's External IPM Key (from `location.ExternalIPMKey`)
- `visitTypeKey`: Always `"355"` for Initial Consultation
- `appointmentDate`: Format `MM/DD/YYYY`
- `appointmentTime`: Format `H:MM AM/PM` (e.g., `9:00 AM`, `12:30 PM`)
- `firstName`, `lastName`, `birthDate`, `phone`: Patient information
- `email`: Always `null`
- `comments`: Always `"Initial Consult LABORFORCE"`
- `notificationPreference`: Always `"Cell"`

**Response**:
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "result": 0
}
```

**Error Response** (400):
```json
{
  "success": false,
  "message": "Validation failed: Appointment Datetime valid format is yyyyMMddhhmmtt, MM/dd/yyyy hh:mm tt | Can not save appointment for past dates",
  "result": 0
}
```

**Implementation**:
```javascript
import { bookIPMAppointment } from './services/BookingService';

await bookIPMAppointment({
  providerExternalKey: '1302',
  locationExternalKey: '86',
  appointmentDateTime: '202601150900AM',  // YYYYMMDDHHMMAM/PM format
  appointmentTime: '9:00 AM',              // Fallback if appointmentDateTime not available
  startDateTime: new Date().toISOString(), // Final fallback (may have timezone issues)
  firstName: 'John',
  lastName: 'Doe',
  birthDate: '01/01/1990',
  phone: '5555551234',
});
```

**Important Notes**:
- Date/time formats are critical - the function handles conversion from YYYYMMDDHHMMAM/PM to MM/DD/YYYY + H:MM AM/PM
- Priority order: `appointmentDateTime` (best) → `appointmentTime` → `startDateTime` (fallback)
- This booking is non-blocking in the transaction - if it fails, the internal booking still succeeds
- Only executed if both `providerExternalKey` and `locationExternalKey` are available

---

### External API Setup

#### Google Maps API

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable APIs**:
   - Navigate to "APIs & Services" > "Library"
   - Enable the following APIs:
     - Maps SDK for Android
     - Maps SDK for iOS
     - Places API
     - Geocoding API

3. **Create API Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key

4. **Restrict API Key** (Recommended):
   - Edit the API key
   - Under "Application restrictions", select "iOS apps" and/or "Android apps"
   - Add your app's bundle identifier (iOS) or package name (Android)
   - Under "API restrictions", select "Restrict key"
   - Select the APIs you enabled in step 2

5. **Add to Configuration**:
   ```env
   GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

---

## Project Structure

```
case-management-app/
├── frontend/                       # React Native app
│   ├── .expo/                     # Expo configuration cache
│   ├── assets/                    # Images, fonts, icons
│   │   ├── images/
│   │   └── fonts/
│   ├── components/                # Reusable UI components
│   │   ├── Button.js
│   │   ├── Card.js
│   │   ├── Input.js
│   │   └── ...
│   ├── config/                    # Configuration files
│   │   └── constants.js          # Environment variables loader
│   ├── navigation/                # Navigation configuration
│   │   └── AppNavigator.js
│   ├── screens/                   # Screen components
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── InitialConsultationScreen.js
│   │   ├── ConfirmAppointmentScreen.js  # (Updated v1.1.0 - IPM booking integration)
│   │   ├── AppointmentsScreen.js        # (Updated v1.1.0 - Smart sorting & directions)
│   │   ├── TeamScreen.js
│   │   ├── PatientInfoScreen.js
│   │   └── ...
│   ├── services/                  # API service modules
│   │   ├── authService.js        # Authentication APIs
│   │   ├── BookingService.js     # (New v1.1.0) Dual booking system
│   │   ├── referringProviderService.js  # Provider/Location APIs
│   │   ├── referralScheduleService.js   # Referral Schedule APIs
│   │   ├── notificationService.js
│   │   └── ...
│   ├── types/                     # TypeScript type definitions (if using TS)
│   ├── utils/                     # Utility functions
│   ├── .env                       # Environment variables (DO NOT COMMIT)
│   ├── .env.example              # Environment template
│   ├── app.config.js             # Expo configuration
│   ├── App.js                    # Root component
│   ├── package.json              # Dependencies
│   └── ...
├── backend/                       # Optional custom backend
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── server.js
├── docs/                          # Additional documentation
├── .gitignore                    # Git ignore rules
├── README.md                     # This file
└── package.json                  # Root package.json
```

### Key Files

#### `frontend/config/constants.js`
Loads and validates environment variables from `.env` file, including the new `WIDGET_API_URL` for IPM booking.

#### `frontend/services/BookingService.js` (New in v1.1.0)
Handles dual booking system with three main functions:
- `bookIPMAppointment()` - Books appointments on external IPM/EZDocs system
- `bookAppointmentTransaction()` - Orchestrates internal referral + schedule + external IPM booking
- Helper functions for date/time format conversion

#### `frontend/services/authService.js`
Handles user authentication, patient management, and referral creation.

#### `frontend/services/referringProviderService.js`
Manages referring provider and location data fetching.

#### `frontend/services/referralScheduleService.js`
Handles referral schedule creation and listing.

#### `frontend/screens/InitialConsultationScreen.js`
Main appointment booking screen with provider/location/timeslot selection.

#### `frontend/screens/ConfirmAppointmentScreen.js` (Updated in v1.1.0)
Appointment confirmation screen with IPM booking integration. Extracts external keys from provider/location objects and retrieves patient data from AsyncStorage to pass to the dual booking transaction.

#### `frontend/screens/AppointmentsScreen.js` (Updated in v1.1.0)
Displays user's appointments with smart chronological sorting (earliest dates first) and integrated directions to appointment locations.

---

## Key Features

### 1. Patient Registration
- Multi-step registration flow
- Form validation
- Data persistence in AsyncStorage
- Integration with backend patient API

### 2. Referring Provider Selection
- Fetch providers with external IDs
- Search and filter capabilities
- Provider details display
- Automatic location loading

### 3. Location-based Services
- Google Maps integration
- Location search and autocomplete
- Distance calculation
- Address validation

### 4. Dual Appointment Booking System (Version 1.1.0+)
- **Sequential Booking**: Books appointments in both internal and external systems
- **Internal Booking**: Creates referral and schedule in cmdemo.ezdocs.app system
- **External IPM Booking**: Books appointments in widget.ahccenters.com system
- **Non-blocking External Booking**: Internal booking always succeeds even if IPM booking fails
- **Smart Date/Time Handling**: Automatic conversion between multiple date/time formats
- **External Key Management**: Fallback chains for finding provider/location external keys

### 5. Appointment Scheduling
- Real-time availability checking
- Time slot selection
- Multi-day calendar view
- Timezone handling
- **Smart Sorting** (v1.1.0+): Appointments sorted chronologically with earliest dates first
- **Integrated Directions** (v1.1.0+): Navigate to appointment locations with one tap

### 6. Referral Management
- Create IN-type referrals
- Link referrals to providers
- Track referral status
- Comments and metadata

### 7. Notifications
- Push notifications (Expo)
- In-app notifications
- Appointment reminders

### 8. Offline Support
- AsyncStorage for local data
- Offline queue for API requests
- Data synchronization
- Offline indicators

### 9. Internationalization
- Multi-language support (i18next)
- Dynamic language switching
- RTL language support
- Locale-specific formatting

---

## Development Guide

### Code Style

We follow the Airbnb JavaScript Style Guide with some modifications:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Line Length**: 100 characters max
- **Naming**:
  - Components: PascalCase (e.g., `UserProfile.js`)
  - Functions: camelCase (e.g., `fetchUserData`)
  - Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Linting

```bash
# Lint all files
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Debugging

#### React Native Debugger

1. Install React Native Debugger:
   ```bash
   brew install --cask react-native-debugger
   ```

2. Start the app in debug mode
3. Open React Native Debugger
4. Enable debugging in the app (shake device/simulator → "Debug")

#### Console Logging

The app includes extensive console logging for API requests/responses:

```javascript
// Example from referralScheduleService.js
console.log('═══════════════════════════════════════');
console.log('📅 REFERRALSCHEDULES/ADD API REQUEST');
console.log('═══════════════════════════════════════');
console.log('Endpoint: POST', `${BASE_API_URL}/referralschedules/add`);
console.log('Body:', JSON.stringify(requestBody, null, 2));
```

#### Expo DevTools

Access Expo DevTools at `http://localhost:19002` when the dev server is running.

### Common Development Tasks

#### Add a New Screen

1. Create screen file in `frontend/screens/`:
   ```javascript
   // frontend/screens/NewScreen.js
   import React from 'react';
   import { View, Text } from 'react-native';

   export default function NewScreen({ navigation }) {
     return (
       <View>
         <Text>New Screen</Text>
       </View>
     );
   }
   ```

2. Add route to navigation:
   ```javascript
   // frontend/navigation/AppNavigator.js
   import NewScreen from '../screens/NewScreen';

   <Stack.Screen name="NewScreen" component={NewScreen} />
   ```

#### Add a New API Service

1. Create service file in `frontend/services/`:
   ```javascript
   // frontend/services/newService.js
   import axios from 'axios';
   import { BASE_API_URL, APP_SECRET } from '../config/constants';

   export async function fetchData() {
     const response = await axios.get(`${BASE_API_URL}/endpoint`);
     return response.data;
   }
   ```

2. Import and use in components:
   ```javascript
   import { fetchData } from '../services/newService';

   const data = await fetchData();
   ```

#### Add Environment Variable

1. Add to `frontend/.env`:
   ```env
   NEW_API_URL=https://example.com/api
   ```

2. Add to `app.config.js`:
   ```javascript
   extra: {
     newApiUrl: process.env.NEW_API_URL
   }
   ```

3. Add to `frontend/config/constants.js`:
   ```javascript
   export const NEW_API_URL = requireConfig('NEW_API_URL', 'newApiUrl', 'NEW_API_URL');
   ```

---

## Deployment

### Build for Production

#### iOS

1. **Configure App Signing**:
   - Open Xcode
   - Select your project → Signing & Capabilities
   - Set your Team and Bundle Identifier

2. **Build with EAS**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit to App Store**:
   ```bash
   eas submit --platform ios
   ```

#### Android

1. **Generate Keystore** (first time only):
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore my-app.keystore \
     -alias my-app-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Build with EAS**:
   ```bash
   eas build --platform android --profile production
   ```

3. **Submit to Google Play**:
   ```bash
   eas submit --platform android
   ```

### Environment-Specific Builds

Use EAS Build profiles in `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "staging": {
      "distribution": "internal",
      "env": {
        "API_BASE_URL": "https://staging.api.example.com"
      }
    },
    "production": {
      "env": {
        "API_BASE_URL": "https://api.example.com"
      }
    }
  }
}
```

Build specific profile:
```bash
eas build --platform all --profile staging
```

---

## Troubleshooting

### Common Issues

#### 1. IPM Booking Date Validation Error (Version 1.1.0+)

**Symptom**: Error "Validation failed: Appointment Datetime valid format is yyyyMMddhhmmtt, MM/dd/yyyy hh:mm tt | Can not save appointment for past dates"

**Root Cause**: The IPM booking endpoint requires specific date/time formats and timezone-aware dates. Using UTC times can result in past dates in local timezone.

**Solution**:
- The [BookingService.js](frontend/services/BookingService.js) now handles this automatically
- Uses priority: `appointmentDateTime` (YYYYMMDDHHMMAM/PM) → `appointmentTime` → `startDateTime`
- Converts formats automatically to MM/DD/YYYY + H:MM AM/PM
- If you see this error, check that the appointment time slots are providing the `AppointmentDateTime` field

**Debug Tips**:
```javascript
// Check console logs for debug information
console.log('[IPM Booking] Request:', {
  rawAppointmentDateTime: appointmentDateTime,
  rawAppointmentTime: appointmentTime,
  finalDate: appointmentDate,
  finalTime: appointmentTimeFormatted,
});
```

#### 2. Missing External IPM Keys

**Symptom**: IPM booking is skipped with warning "Skipping IPM booking - missing external keys"

**Root Cause**: Provider or location doesn't have External IPM keys configured

**Solution**:
- Verify provider has `ExternalIPMKey` or similar field in API response
- Verify location has `ExternalIPMKey` or similar field in API response
- The system tries multiple field name variations:
  ```javascript
  location?.ExternalIPMKey ?? location?.LocationExternalIPMKey ??
  location?.externalIPMKey ?? location?.externalIpmKey ??
  location?.ExternalKey ?? location?.externalKey
  ```
- If keys are missing, only internal booking will occur (this is by design)

#### 3. "AppSecret or Token missing" Error

**Symptom**: 401 Unauthorized error with message about missing AppSecret or Token

**Solution**:
- Verify `EXTERNAL_APP_SECRET` is set in `.env`
- Check that token is being retrieved from AsyncStorage
- For Timeslots API, ensure you're NOT sending Token header (only AppSecret)

```javascript
// Correct for Timeslots API
headers: {
  'AppSecret': APP_SECRET
  // NO Token header
}
```

#### 4. "Invalid location" Error (400)

**Symptom**: Timeslots API returns "Validation failed: Invalid location"

**Solution**:
- Ensure you're using the **location's ExternalIPMKey**, not the provider's ExternalId
- Verify the location has an ExternalIPMKey field in the API response

```javascript
// Correct
locationKey: location.ExternalIPMKey  // From location API

// Incorrect
locationKey: provider.ExternalId      // Wrong - this is provider's field
```

#### 5. ReferralKey Not Found

**Symptom**: Warning "⚠️ No referralKey - falling back to old booking method"

**Solution**:
- The API returns `ReferalKey` (typo - one 'r') instead of `ReferralKey`
- Code has been updated to handle both spellings
- Check console logs for the actual response structure

#### 6. Expo Build Fails

**Symptom**: Build fails with various errors

**Common Solutions**:
- Clear cache: `expo start -c`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Update Expo: `expo update`
- Check EAS Build logs for specific errors

#### 7. Google Maps Not Showing

**Symptom**: Map component shows blank or gray screen

**Solutions**:
- Verify `GOOGLE_MAPS_API_KEY` is set correctly
- Check API is enabled in Google Cloud Console
- Ensure API key restrictions allow your app's bundle ID/package name
- Check for billing issues in Google Cloud Console

#### 8. Push Notifications Not Working

**Solutions**:
- Ensure you have a valid Expo push token
- Check Expo notification settings in `app.config.js`
- Verify device has notifications enabled for the app
- Test with Expo's push notification tool

### Debug Mode

Enable detailed logging:

```javascript
// In any service file
const DEBUG = true;

if (DEBUG) {
  console.log('Debug info:', data);
}
```

### Network Debugging

Use React Native Debugger or Flipper to inspect network requests:

1. Open React Native Debugger
2. Go to Network tab
3. See all API requests/responses in real-time

### Error Tracking

Consider integrating Sentry for production error tracking:

```bash
npm install @sentry/react-native
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Write/update tests**
5. **Run linting and tests**:
   ```bash
   npm run lint
   npm test
   ```
6. **Commit with clear messages**:
   ```bash
   git commit -m "Add: Brief description of changes"
   ```
7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Create a Pull Request**

### Commit Message Format

We follow the Conventional Commits specification:

- `feat: Add new feature`
- `fix: Bug fix`
- `docs: Documentation changes`
- `style: Code style changes (formatting, etc.)`
- `refactor: Code refactoring`
- `test: Add or update tests`
- `chore: Build process or auxiliary tool changes`

### Code Review Process

1. All PRs require at least one approval
2. Address all review comments
3. Ensure CI/CD checks pass
4. Keep PRs focused and reasonably sized
5. Update documentation as needed

### Reporting Issues

When reporting bugs, please include:
- App version
- Device/OS information
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs if applicable

---

## License

[MIT License](LICENSE)

Copyright (c) 2026 [Your Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **Issues**: [GitHub Issues](https://github.com/your-org/case-management-app/issues)
- **Email**: support@yourorganization.com
- **Slack**: [Your Slack Channel]

---

## Changelog

### Version 1.1.0 (2026-01-05)

**New Features:**
- **Dual Appointment Booking System**: Automatically books appointments in both internal (cmdemo.ezdocs.app) and external IPM/EZDocs (widget.ahccenters.com) systems
- **Smart Appointment Sorting**: Appointments screen now displays appointments chronologically with earliest dates at the top, even across different provider categories
- **Integrated Directions**: One-tap navigation to appointment locations directly from the appointments screen

**New Files:**
- `frontend/services/BookingService.js`: Dual booking orchestration with IPM integration

**Updated Files:**
- `frontend/screens/ConfirmAppointmentScreen.js`: IPM booking integration with external key extraction and patient data retrieval
- `frontend/screens/AppointmentsScreen.js`: Smart sorting algorithm and directions buttons
- `frontend/config/constants.js`: Added `WIDGET_API_URL` configuration

**API Integrations:**
- New: Widget API appointment booking endpoint (`POST /appointment/book-appointment`)
- Enhanced: Dual booking transaction with non-blocking IPM booking

**Technical Improvements:**
- Advanced date/time format conversion (YYYYMMDDHHMMAM/PM ↔ MM/DD/YYYY + H:MM AM/PM)
- External key management with fallback chains for provider/location keys
- Priority-based date extraction to avoid timezone issues
- Non-blocking error handling for external booking failures

**Bug Fixes:**
- Fixed timezone-related "past date" validation errors in IPM booking
- Fixed directions button not showing for Imaging category appointments
- Improved external key detection with multiple field name variations

**Known Issues:**
- IPM booking requires both provider and location to have External IPM keys
- If external keys are missing, only internal booking occurs (by design)

---

### Version 1.0.0 (2026-01-03)

**Features:**
- Initial release
- Patient registration and management
- Referring provider integration
- Appointment booking with timeslots
- Referral creation and tracking
- Multi-language support
- Google Maps integration
- Push notifications

**APIs Integrated:**
- CM Laborforce Team API (Providers, Locations, Referrals, Schedules)
- EZDocs AHC Centers API (Timeslots)
- Widget API

**Known Issues:**
- API response contains typo: `ReferalKey` instead of `ReferralKey` (handled in code)
- Timeslots API requires only AppSecret, not Token (correctly implemented)

---

## Acknowledgments

- **Expo Team**: For the excellent development platform
- **React Native Community**: For the amazing ecosystem
- **Contributors**: Thank you to Arnav Vedavyas and Lokanshu Malur for help building this project.


---

## Additional Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [Axios Documentation](https://axios-http.com/docs/intro)
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

---

**Last Updated**: January 5, 2026