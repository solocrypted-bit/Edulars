require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDatabase, mongoose } = require('./config/db');
const { setupSwagger } = require('./config/swagger');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const schoolRoutes = require('./routes/school');
const writeRoutes = require('./routes/write');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = process.env.FRONTEND_URL || '';
const allowedOrigins = [
  ...configuredOrigins.split(','),
  ...(isProduction ? [] : ['http://localhost:5500', 'http://127.0.0.1:5500'])
]
  .map((origin) => origin.trim())
  .filter(Boolean);

function validateEnvironment() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Configure MongoDB Atlas before starting the API.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid TCP port number.');
  }
  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('FRONTEND_URL must contain at least one allowed frontend origin in production.');
  }
}

app.disable('x-powered-by');
if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by the CORS policy'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/api/auth/register-admin', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

/**
 * @openapi
 * /api/health/live:
 *   get:
 *     tags: [Operations]
 *     summary: Liveness probe
 *     responses:
 *       200:
 *         description: The server process is running
 * /api/health/ready:
 *   get:
 *     tags: [Operations]
 *     summary: Readiness probe including MongoDB connectivity
 *     responses:
 *       200:
 *         description: The API and database are ready
 *       503:
 *         description: The database is not ready
 */
app.get('/api/health/live', (req, res) => {
  res.status(200).json({ status: 'ok', app: 'EDULARS API' });
});

function readinessResponse(req, res) {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ready' : 'not_ready',
    database: databaseReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
}

app.get('/api/health', readinessResponse);
app.get('/api/health/ready', readinessResponse);

app.use('/api/auth', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', schoolRoutes);
app.use('/api', writeRoutes);
setupSwagger(app);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === 'ValidationError' || error.name === 'CastError' || error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid request data' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with that unique value already exists' });
  }
  if (error.message === 'Origin is not allowed by the CORS policy') {
    return res.status(403).json({ message: 'Origin is not allowed' });
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && (error.status < 500 || error.status === 503)
    ? error.status
    : 500;
  if (status === 500) {
    console.error(error);
  }
  return res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message
  });
});

let server;
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received; shutting down gracefully`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  process.exit(0);
}

async function start() {
  validateEnvironment();
  await connectDatabase();
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`EDULARS API listening on port ${PORT}`);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error(`API startup failed: ${error.message}`);
  process.exit(1);
});
