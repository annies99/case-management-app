// scripts/demo-geo.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const hospitals = [
  "Northwestern Memorial Hospital, Chicago, IL",
  "Rush University Medical Center, Chicago, IL",
  "University of Chicago Medical Center, Chicago, IL",
  "Loyola University Medical Center, Maywood, IL",
  "Advocate Lutheran General Hospital, Park Ridge, IL",
  "NorthShore Evanston Hospital, Evanston, IL",
  "Edward Hospital, Naperville, IL",
  "OSF Saint Francis Medical Center, Peoria, IL",
  "Memorial Medical Center, Springfield, IL",
  "Carle Foundation Hospital, Urbana, IL"
];

async function main() {
  const address = process.argv[2] || "876 Heatherfield circle, naperville, IL 60565";
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not set");

  const fetch = (await import("node-fetch")).default;

  const geocode = async (addr) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${apiKey}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.results.length) throw new Error(`No geocode for ${addr}`);
    const { lat, lng } = json.results[0].geometry.location;
    return { lat, lng };
  };

  const origin = await geocode(address);
  const hospitalCoords = await Promise.all(hospitals.map(geocode));

  const distances = hospitalCoords.map((coord, idx) => {
    const R = 6371; // km
    const dLat = (coord.lat - origin.lat) * Math.PI/180;
    const dLon = (coord.lng - origin.lng) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(origin.lat*Math.PI/180) *
              Math.cos(coord.lat*Math.PI/180) *
              Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return { name: hospitals[idx], distanceKm: R * c };
  });

  distances.sort((a,b) => a.distanceKm - b.distanceKm);
  console.log(`Closest hospitals to "${address}":`);
  distances.slice(0,3).forEach(d =>
    console.log(`• ${d.name} – ${d.distanceKm.toFixed(1)} km`)
  );
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
