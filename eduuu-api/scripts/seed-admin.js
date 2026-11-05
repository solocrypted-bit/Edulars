require('dotenv').config();
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { connectDatabase, mongoose } = require('../src/config/db');
const { User, SchoolSettings } = require('../src/models');

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 12 characters.');
  }

  await connectDatabase();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new Error('An account with ADMIN_EMAIL already exists; no password was changed.');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({
    id: randomUUID(),
    name: ADMIN_NAME.trim(),
    email,
    passwordHash,
    role: 'admin',
    status: 'active'
  });

  await SchoolSettings.updateOne(
    { key: 'global' },
    {
      $setOnInsert: {
        schoolName: 'EDULARS Academy',
        academicYear: '2026/2027',
        term: 'First Term',
        language: 'English',
        timezone: 'Africa/Lagos'
      }
    },
    { upsert: true }
  );

  console.log(`Created initial administrator account: ${email}`);
}

seedAdmin()
  .catch((error) => {
    console.error(`Admin seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
