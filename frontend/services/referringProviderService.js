/**
 * Referring Provider Service
 *
 * Handles interactions with the new Referring Provider APIs:
 * - GET /api/externalservice/cm/refferingprovider/list
 * - GET /api/externalservice/cm/refferingprovider/locations
 *
 * These replace the old provider list API for the referral workflow.
 * The ExternalID from these APIs is used for appointment slot lookup and booking
 * instead of the previous external IPM key.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_API_URL, APP_SECRET } from '../config/constants';

/**
 * Fetches the list of referring providers with external IDs
 *
 * Data Flow:
 * 1. User opens referral screen → calls this function
 * 2. Returns list of providers where ExternalID is present
 * 3. User selects provider → ProviderKey + ExternalID stored
 * 4. ExternalID used for subsequent appointment slot/booking operations
 *
 * @param {Object} options
 * @param {boolean} [options.externalKeyOnly=true] - Only return providers with ExternalID set
 * @returns {Promise<Array>} Array of referring providers
 *
 * @throws {Error} If API request fails or returns invalid data
 *
 * @example
 * const providers = await fetchReferringProviders();
 * // Returns:
 * // [
 * //   {
 * //     ProviderKey: 17,
 * //     ProviderName: "Dr. Smith",
 * //     FirstName: "John",
 * //     LastName: "Smith",
 * //     ExternalID: "EXT123",
 * //     Specialty: "Cardiology",
 * //     Phone: "555-0100",
 * //     Email: "jsmith@example.com"
 * //   },
 * //   ...
 * // ]
 */
export async function fetchReferringProviders({ externalKeyOnly = true } = {}) {
  try {
    // Retrieve auth token from storage
    const token = await AsyncStorage.getItem('authToken');

    // Build query parameters
    const params = {};
    if (externalKeyOnly) {
      params.externalKey = 'true';
    }

    console.log('═══════════════════════════════════════');
    console.log('👨‍⚕️ REFFERINGPROVIDER/LIST API REQUEST');
    console.log('═══════════════════════════════════════');
    console.log('Endpoint: GET', `${LOCATION_API_URL}/refferingprovider/list`);
    console.log('Params:', JSON.stringify(params, null, 2));
    console.log('Headers:', {
      'Accept': 'application/json',
      'AppSecret': APP_SECRET ? '***' : 'MISSING',
      'Token': token ? `${token.substring(0, 20)}...` : 'MISSING',
    });
    console.log('═══════════════════════════════════════');

    // Make API request
    const response = await axios.get(
      `${LOCATION_API_URL}/refferingprovider/list`,
      {
        params,
        headers: {
          'Accept': 'application/json',
          'AppSecret': APP_SECRET,
          ...(token && { 'Token': token }),
        },
        timeout: 30000,
      }
    );

    // Handle response
    const { data } = response;

    console.log('═══════════════════════════════════════');
    console.log('👨‍⚕️ REFFERINGPROVIDER/LIST API RESPONSE');
    console.log('═══════════════════════════════════════');
    console.log('Response keys:', Object.keys(data));
    console.log('data.success:', data.success);
    console.log('data.result type:', Array.isArray(data.result) ? 'array' : typeof data.result);
    console.log('data.result length:', data.result?.length);
    if (data.result && data.result.length > 0) {
      console.log('First provider sample:', JSON.stringify(data.result[0], null, 2));
    }
    console.log('═══════════════════════════════════════');

    // Normalize response - API may return data in different structures
    let providers = [];
    if (data?.result) {
      providers = Array.isArray(data.result) ? data.result : [data.result];
    } else if (data?.providers) {
      providers = Array.isArray(data.providers) ? data.providers : [data.providers];
    } else if (Array.isArray(data)) {
      providers = data;
    } else if (data?.success === false) {
      throw new Error(data.message || 'Failed to fetch referring providers');
    }

    // Validate that we have data
    if (!Array.isArray(providers) || providers.length === 0) {
      console.warn('⚠️ No referring providers returned from API');
      console.warn('⚠️ Full response data:', JSON.stringify(data, null, 2));
      return [];
    }

    console.log(`✅ Fetched ${providers.length} referring provider(s)`);
    return providers;

  } catch (error) {
    console.error('❌ Error fetching referring providers:', error);

    // Provide helpful error messages
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. Check your AppSecret configuration.');
      } else if (status === 404) {
        throw new Error('Referring provider API endpoint not found.');
      } else {
        throw new Error(`Failed to fetch referring providers: ${message}`);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to fetch referring providers');
    }
  }
}

/**
 * Fetches locations for a specific referring provider
 *
 * Data Flow:
 * 1. User selects referring provider → calls this function with ProviderKey
 * 2. Returns list of locations for that provider
 * 3. User selects location → LocationKey + location details stored
 * 4. Provider + Location stored as IN-type record in referral
 *
 * @param {number|string} referringProviderKey - The ProviderKey from selected referring provider
 * @returns {Promise<Array>} Array of locations for the provider
 *
 * @throws {Error} If providerKey is missing or API request fails
 *
 * @example
 * const locations = await fetchReferringProviderLocations(17);
 * // Returns:
 * // [
 * //   {
 * //     LocationKey: 101,
 * //     LocationDescription: "Main Office",
 * //     Phone: "555-0100",
 * //     Address1: "123 Medical Plaza",
 * //     City: "San Francisco",
 * //     State: "CA",
 * //     Zip: "94102",
 * //     ExternalIPMKey: "IPM456",
 * //     Latitude: 37.7749,
 * //     Longitude: -122.4194
 * //   },
 * //   ...
 * // ]
 */
export async function fetchReferringProviderLocations(referringProviderKey) {
  try {
    // Validate input
    if (!referringProviderKey) {
      throw new Error('Provider key is required to fetch locations');
    }

    // Trim and validate provider key
    const providerKey = String(referringProviderKey).trim();
    if (!providerKey) {
      throw new Error('Provider key cannot be empty');
    }

    // Retrieve auth token from storage
    const token = await AsyncStorage.getItem('authToken');

    console.log('═══════════════════════════════════════');
    console.log('📍 REFFERINGPROVIDER/LOCATIONS API REQUEST');
    console.log('═══════════════════════════════════════');
    console.log('Endpoint: GET', `${LOCATION_API_URL}/refferingprovider/locations`);
    console.log('Params:', JSON.stringify({ refferingProviderKey: providerKey }, null, 2));
    console.log('Headers:', {
      'Accept': 'application/json',
      'AppSecret': APP_SECRET ? '***' : 'MISSING',
      'Token': token ? `${token.substring(0, 20)}...` : 'MISSING',
    });
    console.log('═══════════════════════════════════════');

    // Make API request
    const response = await axios.get(
      `${LOCATION_API_URL}/refferingprovider/locations`,
      {
        params: {
          refferingProviderKey: providerKey,
        },
        headers: {
          'Accept': 'application/json',
          'AppSecret': APP_SECRET,
          ...(token && { 'Token': token }),
        },
        timeout: 30000,
      }
    );

    // Handle response
    const { data } = response;

    console.log('═══════════════════════════════════════');
    console.log('📍 REFFERINGPROVIDER/LOCATIONS API RESPONSE');
    console.log('═══════════════════════════════════════');
    console.log('Response keys:', Object.keys(data));
    console.log('data.success:', data?.success);
    console.log('Full response:', JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════');

    // Normalize response - API may return data in different structures
    let locations = [];
    if (data?.result) {
      locations = Array.isArray(data.result) ? data.result : [data.result];
    } else if (data?.locations) {
      locations = Array.isArray(data.locations) ? data.locations : [data.locations];
    } else if (Array.isArray(data)) {
      locations = data;
    } else if (data?.success === false) {
      throw new Error(data.message || 'Failed to fetch provider locations');
    }

    // Validate that we have data
    if (!Array.isArray(locations)) {
      console.warn(`⚠️ No locations returned for provider ${providerKey}`);
      return [];
    }

    console.log(`✅ Fetched ${locations.length} location(s) for provider ${providerKey}`);
    return locations;

  } catch (error) {
    console.error('❌ Error fetching referring provider locations:', error);

    // Provide helpful error messages
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. Check your AppSecret configuration.');
      } else if (status === 404) {
        throw new Error('Provider locations API endpoint not found or provider has no locations.');
      } else {
        throw new Error(`Failed to fetch provider locations: ${message}`);
      }
    } else if (error.request) {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to fetch provider locations');
    }
  }
}

/**
 * Helper function to format referring provider for display in dropdown
 *
 * @param {Object} provider - Raw provider object from API
 * @returns {Object} Formatted provider for UI display
 *
 * @example
 * const formatted = formatReferringProviderForDropdown(rawProvider);
 * // Returns:
 * // {
 * //   Id: 17,
 * //   Description: "Dr. John Smith - Cardiology",
 * //   ProviderKey: 17,
 * //   ExternalID: "EXT123",
 * //   rawData: { ... }
 * // }
 */
export function formatReferringProviderForDropdown(provider) {
  if (!provider) return null;

  const displayName = provider.ProviderName ||
    `${provider.FirstName || ''} ${provider.LastName || ''}`.trim() ||
    'Unknown Provider';

  const specialty = provider.Specialty ? ` - ${provider.Specialty}` : '';

  return {
    Id: provider.ProviderKey,
    Description: `${displayName}${specialty}`,
    ProviderKey: provider.ProviderKey,
    ExternalID: provider.ExternalID,
    rawData: provider,
  };
}

/**
 * Helper function to format provider location for display in dropdown
 *
 * @param {Object} location - Raw location object from API
 * @returns {Object} Formatted location for UI display
 *
 * @example
 * const formatted = formatProviderLocationForDropdown(rawLocation);
 * // Returns:
 * // {
 * //   Id: 101,
 * //   Description: "Main Office - 123 Medical Plaza, San Francisco, CA",
 * //   LocationKey: 101,
 * //   rawData: { ... }
 * // }
 */
export function formatProviderLocationForDropdown(location) {
  if (!location) return null;

  const name = location.LocationDescription || 'Unknown Location';

  // Build address string
  const addressParts = [];
  if (location.Address1) addressParts.push(location.Address1);
  if (location.City) addressParts.push(location.City);
  if (location.State) addressParts.push(location.State);

  const address = addressParts.length > 0 ? ` - ${addressParts.join(', ')}` : '';

  return {
    Id: location.LocationKey,
    Description: `${name}${address}`,
    LocationKey: location.LocationKey,
    rawData: location,
  };
}
