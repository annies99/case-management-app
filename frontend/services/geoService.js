// frontend/services/geoService.js

import { GOOGLE_MAPS_API_KEY } from '../config/constants';

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';
const DISTANCE_MATRIX_ENDPOINT = 'https://maps.googleapis.com/maps/api/distancematrix/json';

const toNumber = value => {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

export async function geocodeAddress(address) {
  const raw = typeof address === 'string' ? address : String(address || '');
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Address is required for geocoding');

  const params = new URLSearchParams({ address: trimmed, key: GOOGLE_MAPS_API_KEY });

  let response;
  try {
    response = await fetch(`${GEOCODE_ENDPOINT}?${params.toString()}`);
  } catch (err) {
    throw new Error('Unable to reach the geocoding service. Please check your connection.');
  }

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Received an invalid response from the geocoding service.');
  }

  if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    const message = data.error_message || data.status || 'No geocoding results found';
    throw new Error(message);
  }

  const { lat, lng } = data.results[0]?.geometry?.location || {};
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  if (latitude == null || longitude == null) {
    throw new Error('Geocoding response was missing coordinates.');
  }

  return { lat: latitude, lon: longitude };
}

// Compute distance between two points in kilometers using the Haversine formula
export function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanceMiles(km) {
  if (km == null || Number.isNaN(km)) return null;
  return km * 0.621371;
}

export async function getDrivingDistancesMiles(originAddress, destinationAddresses) {
  const origin = typeof originAddress === 'string' ? originAddress.trim() : '';
  if (!origin) {
    throw new Error('Origin address is required to calculate driving distances.');
  }

  const destinations = Array.isArray(destinationAddresses)
    ? destinationAddresses
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .map((value, index) => ({ index, value }))
        .filter(entry => Boolean(entry.value))
    : [];

  if (!destinations.length) {
    return [];
  }

  const results = new Array(destinationAddresses.length).fill(null);
  const chunkSize = 25; // Distance Matrix API allows up to 25 destinations per request.

  for (let start = 0; start < destinations.length; start += chunkSize) {
    const chunk = destinations.slice(start, start + chunkSize);
    const params = new URLSearchParams({
      origins: origin,
      destinations: chunk.map(entry => entry.value).join('|'),
      units: 'imperial',
      key: GOOGLE_MAPS_API_KEY,
    });

    let response;
    try {
      response = await fetch(`${DISTANCE_MATRIX_ENDPOINT}?${params.toString()}`);
    } catch (err) {
      throw new Error('Unable to reach the distance matrix service. Please check your connection.');
    }

    if (!response.ok) {
      throw new Error(`Distance matrix request failed with status ${response.status}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error('Received an invalid response from the distance matrix service.');
    }

    if (data.status !== 'OK' || !Array.isArray(data.rows) || !data.rows.length) {
      const message = data.error_message || data.status || 'Distance matrix query failed';
      throw new Error(message);
    }

    const elements = Array.isArray(data.rows[0]?.elements) ? data.rows[0].elements : [];
    chunk.forEach((entry, offset) => {
      const element = elements[offset];
      if (!element || element.status !== 'OK') {
        results[entry.index] = null;
        return;
      }

      const meters = element.distance?.value;
      const miles = typeof meters === 'number' ? meters / 1609.344 : null;
      const kilometers = typeof meters === 'number' ? meters / 1000 : null;

      results[entry.index] = {
        miles,
        kilometers,
        distanceText: element.distance?.text ?? null,
        durationText: element.duration?.text ?? null,
      };
    });
  }

  return results;
}
