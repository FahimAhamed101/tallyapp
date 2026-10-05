const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connect, MONGODB_URI } = require('./db');
const mongoose = require('mongoose');

(async () => {
  const safe = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  console.log('URI      :', safe);
  try {
    const conn = await connect();
    console.log('host     :', conn.host);
    console.log('database :', conn.name);
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ buildInfo: true });
    console.log('mongo    :', info.version);
    const cols = await mongoose.connection.db.listCollections().toArray();
    console.log('collections:', cols.map((c) => c.name).join(', ') || '(none)');
    console.log('PING OK');
  } catch (err) {
    console.error('PING FAILED:', err.message);
    if (err.reason) console.error('reason:', String(err.reason).slice(0, 400));
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
