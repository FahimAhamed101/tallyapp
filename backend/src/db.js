const path = require('path');

// Load backend/.env relative to THIS file, not the process CWD, so
//   `npm start` (inside backend/)
//   `node backend/src/index.js` (from the repo root)
//   `node src/seed.js`
// all read the same configuration. dotenv does not overwrite vars that are
// already set, so an exported MONGODB_URI still wins.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dns = require('dns');
const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb+srv://admin:admin@cluster0.7khaz.mongodb.net/tally';

/**
 * On this machine Node's c-ares resolver is pointed at 127.0.0.1, which refuses
 * SRV queries, so `mongodb+srv://` fails with
 *   querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
 * even though the OS resolver resolves the record fine. Point c-ares at real
 * public resolvers before the driver does its SRV lookup.
 *
 * Override with DNS_SERVERS="10.0.0.1,8.8.8.8" if you need a private resolver.
 */
const DEFAULT_DNS = ['8.8.8.8', '1.1.1.1'];
const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(dnsServers.length ? dnsServers : DEFAULT_DNS);
  } catch (err) {
    console.warn('[db] could not set DNS servers:', err.message);
  }
}

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(MONGODB_URI, {
    dbName: 'tally',
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });

  return mongoose.connection;
}

module.exports = { connect, MONGODB_URI, mongoose };
