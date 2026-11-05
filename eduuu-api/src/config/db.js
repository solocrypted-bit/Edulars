const dns = require('node:dns');
const mongoose = require('mongoose');

const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length) {
  dns.setServers(dnsServers);
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI must be configured before the API can start.');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });

  console.log('Connected to MongoDB');
}

module.exports = { connectDatabase, mongoose };
