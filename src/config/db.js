const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let isConnecting = false;
let retryDelayMs = 1000;
let listenersAttached = false;
let dbReady = false;
let lastError = null;
let connectedDbName = null;

function getDbNameFromUri(uri) {
  try {
    const u = new URL(String(uri));
    const name = String(u.pathname || '').replace(/^\/+/, '');
    return name || null;
  } catch {
    return null;
  }
}

function getRedactedMongoUri(uri) {
  const v = String(uri || '');
  if (!v) return '';
  return v.replace(/\/\/([^@/]+)@/i, '//<redacted>@');
}

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (isConnecting) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB connection error: Missing MONGODB_URI in environment');
    lastError = new Error('Missing MONGODB_URI in environment');
    scheduleRetry();
    return;
  }
  const configuredDbName = getDbNameFromUri(uri);
  if (configuredDbName && configuredDbName !== 'emorri') {
    console.warn(
      `MongoDB warning: MONGODB_URI is targeting database "${configuredDbName}" (expected "emorri").`
    );
  }

  isConnecting = true;
  try {
    await mongoose.connect(uri);
    retryDelayMs = 1000;
    lastError = null;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error(
      'MongoDB connection details:',
      JSON.stringify(
        {
          db: configuredDbName || null,
          uri: getRedactedMongoUri(uri),
        },
        null,
        2
      )
    );
    lastError = error;
    scheduleRetry();
  } finally {
    isConnecting = false;
  }
};

function scheduleRetry() {
  if (mongoose.connection.readyState === 1) return;
  const delay = retryDelayMs;
  retryDelayMs = Math.min(retryDelayMs * 2, 60000);
  setTimeout(() => {
    connectDB().catch(() => {});
  }, delay);
}

if (!listenersAttached) {
  listenersAttached = true;
  mongoose.connection.on('connected', () => {
    dbReady = true;
    connectedDbName = mongoose.connection?.name || null;
    console.log(
      'MongoDB connected:',
      JSON.stringify({ dbReady, db: connectedDbName }, null, 2)
    );
  });
  mongoose.connection.on('disconnected', () => {
    dbReady = false;
    connectedDbName = mongoose.connection?.name || connectedDbName;
    scheduleRetry();
  });
  mongoose.connection.on('error', () => {
    dbReady = false;
    scheduleRetry();
  });
}

connectDB.getDbReady = () => dbReady;
connectDB.getConnectedDbName = () => connectedDbName;
connectDB.getLastError = () =>
  lastError
    ? {
        message: String(lastError.message || ''),
        name: String(lastError.name || ''),
        code: lastError.code,
      }
    : null;

module.exports = connectDB;
