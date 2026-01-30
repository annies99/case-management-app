/**
 * Referral Schedule Service
 *
 * Handles interactions with the Referral Schedules APIs:
 * - GET /api/externalservice/cm/referralschedules/list
 * - POST /api/externalservice/cm/referralschedules/add
 *
 * NEW FLOW:
 * 1. Create referral → capture ReferralKey from response
 * 2. Use ReferralKey + PatientKey to book appointments via /referralschedules/add
 * 3. List appointments via /referralschedules/list
 *
 * This REPLACES the previous CM Demo UI-based booking approach.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL, APP_SECRET } from '../config/constants';

/**
 * Fetches the list of schedules for a specific referral
 *
 * Data Flow:
 * 1. User views referral details → calls this function with ReferralKey
 * 2. Returns all appointments/schedules associated with that referral
 * 3. Display in UI (TeamScreen, AppointmentsScreen, etc.)
 *
 * @param {number|string} referralKey - The ReferralKey from Add Referral API response
 * @returns {Promise<Array>} Array of referral schedules
 *
 * @throws {Error} If referralKey is missing or API request fails
 *
 * @example
 * const schedules = await listReferralSchedules(12007);
 * // Returns:
 * // [
 * //   {
 * //     ReferralScheduleKey: 5001,
 * //     ReferralKey: 12007,
 * //     PatientKey: 5565,
 * //     Status: "Open",
 * //     Comments: "FU- REFF BY: IPM REP BY: VISHAL",
 * //     StartDateTime: "2025-12-04T14:30:00",
 * //     EndDateTime: "2025-12-04T15:15:00",
 * //     ProviderName: "Dr. Smith",
 * //     LocationName: "Main Office"
 * //   },
 * //   ...
 * // ]
 */
export async function listReferralSchedules(referralKey) {
  try {
    // Validate input
    if (!referralKey) {
      throw new Error('Referral key is required to list schedules');
    }

    // Trim and validate referral key
    const refKey = String(referralKey).trim();
    if (!refKey) {
      throw new Error('Referral key cannot be empty');
    }

    // Retrieve auth token from storage
    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    // Make API request
    const response = await axios.get(
      `${BASE_API_URL}/referralschedules/list`,
      {
        params: {
          referralKey: refKey,
        },
        headers: {
          'Accept': 'application/json',
          'AppSecret': APP_SECRET,
          'Token': token,
        },
        timeout: 30000,
      }
    );

    // Handle response
    const { data } = response;

    // Normalize response - API may return data in different structures
    let schedules = [];
    if (data?.result) {
      schedules = Array.isArray(data.result) ? data.result : [data.result];
    } else if (data?.schedules) {
      schedules = Array.isArray(data.schedules) ? data.schedules : [data.schedules];
    } else if (Array.isArray(data)) {
      schedules = data;
    } else if (data?.success === false) {
      throw new Error(data.message || 'Failed to fetch referral schedules');
    }

    // Validate that we have data (empty array is valid - referral may have no schedules yet)
    if (!Array.isArray(schedules)) {
      console.warn(`⚠️ Invalid schedules response for referral ${refKey}`);
      return [];
    }

    console.log(`✅ Fetched ${schedules.length} schedule(s) for referral ${refKey}`);
    return schedules;

  } catch (error) {
    console.error('❌ Error fetching referral schedules:', error);

    // Provide helpful error messages
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. Check your AppSecret configuration.');
      } else if (status === 404) {
        throw new Error('Referral schedules API endpoint not found or referral does not exist.');
      } else {
        throw new Error(`Failed to fetch referral schedules: ${message}`);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to fetch referral schedules');
    }
  }
}

/**
 * Creates a new appointment/schedule for a referral
 *
 * NEW BOOKING FLOW:
 * 1. Create referral via Add Referral API → capture ReferralKey
 * 2. User selects appointment slot
 * 3. Call this function to book appointment
 * 4. No longer use CM Demo UI for booking
 *
 * Data Flow:
 * 1. ConfirmAppointmentScreen calls this after user confirms slot
 * 2. Provides ReferralKey (from referral creation), PatientKey, and slot times
 * 3. API creates schedule record and returns ReferralScheduleKey
 *
 * @param {Object} scheduleData
 * @param {number} scheduleData.ReferralKey - Required: from Add Referral response
 * @param {number} scheduleData.PatientKey - Required: patient identifier
 * @param {string} scheduleData.StartDateTime - Required: ISO 8601 format (e.g., "2025-12-04T14:30:00")
 * @param {string} scheduleData.EndDateTime - Required: ISO 8601 format (e.g., "2025-12-04T15:15:00")
 * @param {string} [scheduleData.Status="Open"] - Initial status (typically "Open")
 * @param {string} [scheduleData.Comments=""] - Free-text comments/metadata
 * @returns {Promise<Object>} Created schedule record
 *
 * @throws {Error} If required fields are missing or API request fails
 *
 * @example
 * const schedule = await addReferralSchedule({
 *   ReferralKey: 12007,
 *   PatientKey: 5565,
 *   StartDateTime: "2025-12-04T14:30:00",
 *   EndDateTime: "2025-12-04T15:15:00",
 *   Status: "Open",
 *   Comments: "Initial consultation"
 * });
 * // Returns:
 * // {
 * //   success: true,
 * //   message: "Schedule created successfully",
 * //   result: {
 * //     ReferralScheduleKey: 5001,
 * //     ReferralKey: 12007,
 * //     PatientKey: 5565,
 * //     Status: "Open",
 * //     Comments: "Initial consultation",
 * //     StartDateTime: "2025-12-04T14:30:00",
 * //     EndDateTime: "2025-12-04T15:15:00"
 * //   }
 * // }
 */
export async function addReferralSchedule(scheduleData) {
  try {
    // Validate required fields
    if (!scheduleData) {
      throw new Error('Schedule data is required');
    }

    const { ReferralKey, PatientKey, StartDateTime, EndDateTime } = scheduleData;

    if (!ReferralKey) {
      throw new Error('ReferralKey is required to create a schedule');
    }
    if (!PatientKey) {
      throw new Error('PatientKey is required to create a schedule');
    }
    if (!StartDateTime) {
      throw new Error('StartDateTime is required to create a schedule');
    }
    if (!EndDateTime) {
      throw new Error('EndDateTime is required to create a schedule');
    }

    // Validate datetime formats (basic ISO 8601 check)
    const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    if (!isoDateTimeRegex.test(StartDateTime)) {
      throw new Error('StartDateTime must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)');
    }
    if (!isoDateTimeRegex.test(EndDateTime)) {
      throw new Error('EndDateTime must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)');
    }

    // Retrieve auth token from storage
    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    // Build request body
    const requestBody = {
      ReferralKey: parseInt(ReferralKey, 10),
      PatientKey: parseInt(PatientKey, 10),
      StartDateTime,
      EndDateTime,
      Status: scheduleData.Status || 'Open',
      Comments: scheduleData.Comments || '',
    };

    console.log('═══════════════════════════════════════');
    console.log('📅 REFERRALSCHEDULES/ADD API REQUEST');
    console.log('═══════════════════════════════════════');
    console.log('Endpoint: POST', `${BASE_API_URL}/referralschedules/add`);
    console.log('Headers:', {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'AppSecret': APP_SECRET ? '***' : 'MISSING',
      'Token': token ? `${token.substring(0, 20)}...` : 'MISSING',
    });
    console.log('\n🔑 FULL AUTH TOKEN (for copy/paste):');
    console.log(token);
    console.log('');
    console.log('Body:', JSON.stringify(requestBody, null, 2));
    console.log('═══════════════════════════════════════');

    // Make API request
    const response = await axios.post(
      `${BASE_API_URL}/referralschedules/add`,
      requestBody,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'AppSecret': APP_SECRET,
          'Token': token,
        },
        timeout: 30000,
      }
    );

    // Handle response
    const { data } = response;

    console.log('═══════════════════════════════════════');
    console.log('📅 REFERRALSCHEDULES/ADD API RESPONSE');
    console.log('═══════════════════════════════════════');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════');

    // Check for API-level success
    if (data?.success === false) {
      throw new Error(data.message || 'Failed to create referral schedule');
    }

    // Validate response structure
    if (!data?.result && !data?.ReferralScheduleKey) {
      console.warn('⚠️ Unexpected response structure from add referral schedule API');
    }

    console.log('✅ Referral schedule created successfully');
    return data;

  } catch (error) {
    console.error('❌ Error creating referral schedule:', error);

    // Provide helpful error messages
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 400) {
        throw new Error(`Invalid request: ${message}`);
      } else if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. Check your AppSecret configuration.');
      } else if (status === 404) {
        throw new Error('Referral schedules API endpoint not found.');
      } else if (status === 409) {
        throw new Error(`Conflict: ${message}`);
      } else {
        throw new Error(`Failed to create referral schedule: ${message}`);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to create referral schedule');
    }
  }
}

/**
 * Helper function to format slot datetime to ISO 8601 format for API
 *
 * Converts from various date/time formats to ISO 8601 (YYYY-MM-DDTHH:mm:ss)
 *
 * @param {Date|string} dateTime - Date object or string
 * @returns {string} ISO 8601 formatted datetime
 *
 * @example
 * formatDateTimeForScheduleAPI(new Date("2025-12-04T14:30:00"));
 * // Returns: "2025-12-04T14:30:00"
 */
export function formatDateTimeForScheduleAPI(dateTime) {
  if (!dateTime) {
    throw new Error('DateTime is required');
  }

  let date;
  if (dateTime instanceof Date) {
    date = dateTime;
  } else {
    date = new Date(dateTime);
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid datetime value');
  }

  // Format as YYYY-MM-DDTHH:mm:ss (ISO 8601 without timezone)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Helper function to format schedule for display
 *
 * @param {Object} schedule - Raw schedule object from API
 * @returns {Object} Formatted schedule for UI display
 *
 * @example
 * const formatted = formatScheduleForDisplay(rawSchedule);
 * // Returns:
 * // {
 * //   key: "5001",
 * //   date: "12/04/2025",
 * //   time: "2:30 PM - 3:15 PM",
 * //   status: "Open",
 * //   provider: "Dr. Smith",
 * //   location: "Main Office",
 * //   comments: "Initial consultation",
 * //   rawData: { ... }
 * // }
 */
export function formatScheduleForDisplay(schedule) {
  if (!schedule) return null;

  // Parse dates
  const startDate = schedule.StartDateTime ? new Date(schedule.StartDateTime) : null;
  const endDate = schedule.EndDateTime ? new Date(schedule.EndDateTime) : null;

  // Format date (MM/DD/YYYY)
  const dateString = startDate
    ? `${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}/${startDate.getFullYear()}`
    : 'N/A';

  // Format time (H:MM AM/PM)
  const formatTime = (date) => {
    if (!date) return 'N/A';
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const timeString = startDate && endDate
    ? `${formatTime(startDate)} - ${formatTime(endDate)}`
    : 'N/A';

  return {
    key: String(schedule.ReferralScheduleKey || schedule.Id || ''),
    date: dateString,
    time: timeString,
    status: schedule.Status || 'Unknown',
    provider: schedule.ProviderName || 'N/A',
    location: schedule.LocationName || 'N/A',
    comments: schedule.Comments || '',
    startDateTime: startDate,
    endDateTime: endDate,
    rawData: schedule,
  };
}
