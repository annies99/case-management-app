const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY not set. Populate it in your .env file.');
}

async function geocodeAddress(address) {
  const params = new URLSearchParams({ address, key: API_KEY });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || data.status || 'Geocoding failed');
  }
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lon: lng };
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  // Use the patient's address from the command line or default to downtown Chicago
  const patientAddress =
    process.argv[2] || '876 Heatherfield circle, naperville, IL 60565';

  // Sample Illinois hospital locations
  const locations = [
    {
      name: 'Northwestern Memorial Hospital',
      address: '251 E Huron St, Chicago, IL 60611',
    },
    {
      name: 'Rush University Medical Center',
      address: '1650 W Harrison St, Chicago, IL 60612',
    },
    {
      name: 'University of Chicago Medical Center',
      address: '5841 S Maryland Ave, Chicago, IL 60637',
    },
    {
      name: 'Loyola University Medical Center',
      address: '2160 S 1st Ave, Maywood, IL 60153',
    },
    {
      name: 'Advocate Illinois Masonic Medical Center',
      address: '836 W Wellington Ave, Chicago, IL 60657',
    },
    {
      name: 'Advocate Good Samaritan Hospital',
      address: '3815 Highland Ave, Downers Grove, IL 60515',
    },
    {
      name: 'Northwestern Medicine Central DuPage Hospital',
      address: '25 N Winfield Rd, Winfield, IL 60190',
    },
    {
      name: 'OSF Saint Francis Medical Center',
      address: '530 NE Glen Oak Ave, Peoria, IL 61637',
    },
    {
      name: 'Springfield Memorial Hospital',
      address: '701 N 1st St, Springfield, IL 62702',
    },
    {
      name: 'Carle Foundation Hospital',
      address: '611 W Park St, Urbana, IL 61801',
    },
  ];

  console.log(`Geocoding patient: ${patientAddress}`);
  const p = await geocodeAddress(patientAddress);
  const results = [];
  for (const loc of locations) {
    try {
      const l = await geocodeAddress(loc.address);
      const dist = distanceKm(p.lat, p.lon, l.lat, l.lon);
      results.push({ ...loc, distance: dist });
    } catch (err) {
      console.warn(`Failed geocoding ${loc.name}: ${err.message}`);
    }
  }
  results.sort((a, b) => a.distance - b.distance);
  console.log('\nNearest locations:');
  results.slice(0, 3).forEach(r => {
    console.log(`${r.name} (${r.address}) -> ${r.distance.toFixed(1)} km`);
  });
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});