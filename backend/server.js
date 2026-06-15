const app = require('./src/app');
const connectDB = require('./src/config/db');
const startCronJobs = require('./src/cron/cronJobs');
const fs = require('fs');
const path = require('path');

// Setup file logging for /logs route
const logFile = path.join(__dirname, 'server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const formatLog = (msg) => {
  return `[${new Date().toISOString()}] ${msg}\n`;
};

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logStream.write(formatLog(`LOG: ${msg}`));
  originalLog.apply(console, args);
};

console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logStream.write(formatLog(`ERROR: ${msg}`));
  originalError.apply(console, args);
};

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Initialize Cron Jobs
startCronJobs();

// Keep-Awake Ping for Render Free Tier (prevents sleeping and cold-start CORS errors)
const selfUrl = process.env.RENDER_EXTERNAL_URL; // Render automatically sets this
if (selfUrl) {
  const axios = require('axios');
  setInterval(() => {
    axios.post(`${selfUrl}/api/admin/heartbeat`)
      .then(res => console.log(`[Keep-Awake] Pinged self successfully: ${res.status}`))
      .catch(err => console.error(`[Keep-Awake] Failed to ping self:`, err.message));
  }, 14 * 60 * 1000); // 14 minutes
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
