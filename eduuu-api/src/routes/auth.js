const { createHash, randomBytes, randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const nodemailer = require('nodemailer');
const { rateLimit } = require('express-rate-limit');
const { signToken, authenticate, asyncHandler } = require('../middleware/auth');
const { mongoose } = require('../config/db');
const { AdminRegistration, SchoolSettings, User } = require('../models');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again later.' }
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Try again later.' }
});
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Try again later.' }
});

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function tokenDigest(token) {
  return createHash('sha256').update(token).digest('hex');
}

function validateSchoolLogo(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) return '';
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw statusError('School logo must be a PNG, JPEG, or WebP image.', 400);

  const image = Buffer.from(match[2], 'base64');
  if (image.length > 1024 * 1024) throw statusError('School logo must be no larger than 1 MB.', 400);
  const isPng = match[1] === 'png' && image.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const isJpeg = match[1] === 'jpeg' && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isWebp = match[1] === 'webp' && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  if (!isPng && !isJpeg && !isWebp) throw statusError('School logo file contents do not match its image type.', 400);
  return dataUrl;
}

function getMailConfiguration() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;
  const frontendUrl = process.env.PUBLIC_FRONTEND_URL;
  const smtpConfigured = Boolean(host || user || password || process.env.SMTP_FROM);
  if (!smtpConfigured) return null;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !from || !frontendUrl || ((user && !password) || (!user && password))) {
    throw statusError('Email verification is not configured. Contact the system administrator.', 503);
  }

  let url;
  try {
    url = new URL(frontendUrl);
  } catch {
    throw statusError('Email verification is not configured. Contact the system administrator.', 503);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw statusError('Email verification is not configured. Contact the system administrator.', 503);
  }
  if (!url.pathname.endsWith('.html')) {
    url.pathname = `${url.pathname.replace(/\/?$/, '/')}main.html`;
  }
  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: user ? { user, pass: password } : undefined
    }),
    from,
    frontendUrl: url
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

/**
 * @openapi
 * /api/auth/branding:
 *   get:
 *     tags: [Auth]
 *     summary: Return public school branding and first-admin setup availability
 *     responses:
 *       200:
 *         description: Public login-page branding
 */
router.get('/branding', asyncHandler(async (req, res) => {
  const settings = await SchoolSettings.findOne({ key: 'global' })
    .select('schoolName schoolLogoData')
    .lean();
  const activeAdmin = await User.exists({ role: 'admin', status: 'active' });
  return res.json({
    schoolName: settings?.schoolName || '',
    schoolLogoData: settings?.schoolLogoData || '',
    registrationAvailable: !activeAdmin
  });
}));

/**
 * @openapi
 * /api/auth/register-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Start first-administrator registration and send an email verification link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, schoolName]
 *             properties:
 *               name: { type: string, maxLength: 120 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12, maxLength: 72 }
 *               schoolName: { type: string, maxLength: 120 }
 *               schoolLogoData: { type: string, description: "Optional PNG, JPEG, or WebP data URL" }
 *     responses:
 *       202: { description: Verification email sent }
 *       409: { description: Initial administrator setup is unavailable }
 *       503: { description: Email verification is not configured }
 */
router.post('/register-admin', registrationLimiter, asyncHandler(async (req, res) => {
  const { name, email, password, schoolName, schoolLogoData = '' } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254 ||
      typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72 ||
      typeof schoolName !== 'string' || !schoolName.trim() || schoolName.trim().length > 120) {
    throw statusError('Enter your name, a valid email, a school name, and a password of 12 to 72 bytes.', 400);
  }
  const logo = validateSchoolLogo(schoolLogoData);

  if (await User.exists({ role: 'admin', status: 'active' })) {
    throw statusError('Administrator registration is closed because this school already has an administrator.', 409);
  }
  const mail = getMailConfiguration();
  if (!mail) {
    throw statusError('Email verification is not configured. Contact the system administrator.', 503);
  }
  if (await User.exists({ email: normalizedEmail })) {
    throw statusError('An account with that email already exists.', 409);
  }

  const now = new Date();
  const pending = await AdminRegistration.findOne({ key: 'initial-admin' });
  if (pending && pending.expiresAt > now && pending.email !== normalizedEmail) {
    throw statusError('An administrator registration is already awaiting email verification. Try again later.', 409);
  }
  if (pending && pending.expiresAt <= now) {
    await AdminRegistration.deleteOne({ _id: pending._id });
  }

  const token = randomBytes(32).toString('base64url');
  const verificationTokenHash = tokenDigest(token);
  const pendingValues = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    schoolName: schoolName.trim(),
    schoolLogoData: logo,
    verificationTokenHash,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  };
  if (pending && pending.expiresAt > now) {
    Object.assign(pending, pendingValues);
    await pending.save();
  } else {
    await AdminRegistration.create({ key: 'initial-admin', ...pendingValues });
  }

  const verificationUrl = new URL(mail.frontendUrl);
  verificationUrl.hash = `verify=${token}`;
  const safeName = escapeHtml(name.trim());
  const safeSchoolName = escapeHtml(schoolName.trim());
  try {
    await mail.transport.sendMail({
      from: mail.from,
      to: normalizedEmail,
      subject: 'Verify your administrator email',
      text: `Hello ${name.trim()}, verify your email to activate the administrator account for ${schoolName.trim()}: ${verificationUrl.href}\n\nThis link expires in 24 hours.`,
      html: `<p>Hello ${safeName},</p><p>Verify your email to activate the administrator account for <strong>${safeSchoolName}</strong>.</p><p><a href="${verificationUrl.href}">Verify email address</a></p><p>This link expires in 24 hours. If you did not request this account, you can ignore this message.</p>`
    });
  } catch (error) {
    await AdminRegistration.deleteOne({ verificationTokenHash });
    console.error('Administrator verification email could not be delivered:', error.message);
    throw statusError('Verification email could not be sent. Check the email service configuration and try again.', 503);
  }
  return res.status(202).json({ message: 'Verification email sent. Open the link in that email to activate your administrator account.' });
}));

/**
 * @openapi
 * /api/auth/verify-admin-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email and activate the first administrator account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200: { description: Email verified and administrator account activated }
 *       400: { description: Invalid or expired verification link }
 *       409: { description: An administrator account already exists }
 */
router.post('/verify-admin-email', verificationLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || token.length < 32 || token.length > 100) {
    throw statusError('This verification link is invalid or has expired.', 400);
  }

  const session = await mongoose.startSession();
  let schoolName;
  try {
    await session.withTransaction(async () => {
      const pending = await AdminRegistration.findOne({
        key: 'initial-admin',
        verificationTokenHash: tokenDigest(token),
        expiresAt: { $gt: new Date() }
      }).select('+passwordHash +verificationTokenHash').session(session);
      if (!pending) throw statusError('This verification link is invalid or has expired.', 400);
      const activeAdmin = await User.findOne({ role: 'admin', status: 'active' }).session(session).lean();
      if (activeAdmin) throw statusError('Administrator registration is already complete. Sign in instead.', 409);

      await User.create([{
        id: randomUUID(),
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
        role: 'admin',
        status: 'active',
        emailVerified: true
      }], { session });
      await SchoolSettings.findOneAndUpdate(
        { key: 'global' },
        {
          $set: { schoolName: pending.schoolName, schoolLogoData: pending.schoolLogoData },
          $setOnInsert: {
            academicYear: `${new Date().getUTCFullYear()}/${new Date().getUTCFullYear() + 1}`,
            term: 'First Term',
            language: 'English',
            timezone: 'Africa/Lagos'
          }
        },
        { upsert: true, session, runValidators: true }
      );
      await AdminRegistration.deleteOne({ _id: pending._id }, { session });
      schoolName = pending.schoolName;
    });
  } finally {
    await session.endSession();
  }
  return res.json({ message: 'Email verified. Your administrator account is active.', schoolName });
}));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login to the EDULARS API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Return the authenticated user's current profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current account profile
 *       401:
 *         description: Missing, invalid, or expired token
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findOne({ id: req.user.id }).lean();
  if (!user || user.status !== 'active') {
    return res.status(401).json({ message: 'Account is unavailable' });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}));

module.exports = router;
