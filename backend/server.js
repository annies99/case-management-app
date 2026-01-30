const path = require('path');
const dotenv = require('dotenv');

const envResult = dotenv.config();
if (envResult.error) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory progress map { [user]: number }
const progressMap = {};

// ——— Google Geocoding endpoint ———
// GET /api/geocode?address=1600+Pennsylvania+Ave
app.get('/api/geocode', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address query is required' });
  try {
    const { GOOGLE_MAPS_API_KEY } = process.env;
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json` +
                `?address=${encodeURIComponent(address)}` +
                `&key=${GOOGLE_MAPS_API_KEY}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Geocoding failed', details: err.message });
  }
});

// ——— Twilio SMS sender ———
// POST /api/sms    { to:"+1xxx", body:"Hello" }
app.post('/api/sms', async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) return res.status(400).json({ error: 'to & body are required' });
  try {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
      return res.status(500).json({ error: 'Twilio credentials not configured' });
    }

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      from: TWILIO_PHONE,
      to, body
    });
    res.json({ sid: message.sid });
  } catch (err) {
    res.status(500).json({ error: 'SMS send failed', details: err.message });
  }
});

// ——— Dummy appointment booking ———
// POST /api/book    { doctorId:123, time:"2025-06-01T10:00:00Z" }
app.post('/api/book', (req, res) => {
  const { doctorId, time } = req.body;
  if (!doctorId || !time) return res.status(400).json({ error: 'doctorId & time required' });
  // TODO → replace with real DB/API logic
  res.json({ success: true, appointmentId: Math.floor(Math.random()*10000) });
});

// ——— Progress endpoints ———
// GET /api/progress?user=<id>
app.get('/api/progress', (req, res) => {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'user query is required' });
  const progress = progressMap[user] || 0;
  res.json({ progress });
});

// POST /api/progress    { user:"abc", progress:1 }
app.post('/api/progress', (req, res) => {
  const { user, progress } = req.body;
  if (!user || progress == null) {
    return res.status(400).json({ error: 'user and progress required' });
  }
  progressMap[user] = Number(progress);
  res.json({ success: true });
});

// ——— 404 & error catcher ———
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend up: http://localhost:${PORT}`)
);
