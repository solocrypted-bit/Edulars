# EDULARS API

The EDULARS backend is a standalone Node.js/Express service using MongoDB
Atlas, JWT authentication, role-scoped access, and Swagger/OpenAPI. The static
frontend is maintained separately in the sibling `eduuu/` folder.

## Runtime and security

- Node.js 20 or newer. Render starts the service with `npm start`.
- The server binds to `0.0.0.0` and the platform-provided `PORT`.
- MongoDB and a `JWT_SECRET` of at least 32 characters are mandatory. Startup
  fails closed when either is missing or invalid.
- Passwords are hashed with bcrypt before storage. Login tokens expire after
  eight hours.
- Helmet, CORS origin allowlisting, JSON body limits, login throttling,
  request logging, graceful shutdown, and liveness/readiness probes are
  configured.
- Authenticated routes enforce role permissions and scope student data to
  linked users/classes.

## Local development (Windows)

From this `eduuu-api/` directory:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Set `MONGODB_URI` and a private, random `JWT_SECRET` (minimum 32 characters) in
`.env`. For a local setup, copy `.env.example` and fill in the values. The
frontend runs at `http://127.0.0.1:5500`; development CORS accepts that origin
and `http://localhost:5500`.

```powershell
npm.cmd run dev
```

The API listens at `http://localhost:5000`. `npm.cmd start` runs the same API
without nodemon. MongoDB must be reachable before the server starts. If Node
cannot resolve Atlas SRV records via the system resolver, optionally configure
`DNS_SERVERS` for local development; normally leave it unset on Render.

For the browser signup flow, configure `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and
`PUBLIC_FRONTEND_URL` privately in the environment. The SMTP account sends
the verification message; `PUBLIC_FRONTEND_URL` is the browser-accessible
frontend URL ending in `/main.html`. Then open the frontend and register the
first administrator. The link expires after 24 hours, and the API stores only
a hash of its verification token. Admin signup is available only until the
first active administrator exists.

SMTP must be configured before administrator signup is available, including
for local development. If email delivery is not configured, signup reports
that verification is unavailable and does not create a verification link.

Alternatively, create the initial administrator from a trusted environment
with `npm.cmd run seed:admin`. Configure `ADMIN_NAME`, `ADMIN_EMAIL`, and
`ADMIN_PASSWORD` privately; the password must be at least 12 characters. The
seed command refuses to overwrite an existing account and also closes public
admin signup.

## Render deployment

1. Create a MongoDB Atlas database/user and permit connections from the Render
   service. Prefer a narrow Atlas network allowlist.
2. Deploy this folder as a Render Blueprint using `render.yaml`.
3. Configure `MONGODB_URI`, `FRONTEND_URL` (exact frontend origin without a
   path or trailing slash), `PUBLIC_FRONTEND_URL` (the full frontend URL ending
   in `/main.html`), `API_PUBLIC_URL`, and the SMTP settings in Render.
4. `render.yaml` generates a JWT secret; keep all secrets in Render's
   environment settings, not source control.
5. After deploy, confirm `/api/health/ready` returns HTTP 200 and open
   `/api/docs`.
6. Open the deployed frontend to register and verify the first administrator.
   The seed command can be used instead from a trusted machine if email-based
   signup is not desired.

The frontend defaults to the local API for localhost and to
`https://edulars-api.onrender.com/api` otherwise. If Render assigns a different
public API URL, set `window.EDULARS_API_URL` before `js/data.js` loads in the
frontend's `main.html`. The configured `FRONTEND_URL` must match the browser's
origin for CORS to allow requests.

## API documentation

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api-docs-json`
- Health: `GET /api/health/live`, `GET /api/health/ready`
- Authentication: `GET /api/auth/branding`, `POST /api/auth/register-admin`,
  `POST /api/auth/verify-admin-email`, `POST /api/auth/login`,
  `GET /api/auth/me`
- Dashboard: `GET /api/dashboard`
- Directory reads: `GET /api/students`, `/api/teachers`, `/api/classes`
- Directory writes (administrator): `POST`, `PUT`, `DELETE` on
  `/api/students`, `/api/teachers`, and `/api/classes`
- Account creation (administrator): `POST /api/users` with name, email,
  password, and role (`admin`, `teacher`, `student`, or `parent`)
- Academics reads: `GET /api/academics/grades`,
  `/api/academics/lesson-plans`, `/api/academics/attendance`
- Academics writes: `POST /api/academics/grades`,
  `/api/academics/attendance`, `/api/academics/lesson-plans`;
  `PUT /api/academics/lesson-plans/{id}` for editing/submitting/reviewing
- Assignments: `GET`, `POST /api/assignments`; student submissions use
  `GET`, `POST /api/assignment-submissions`
- Finance reads: `GET /api/finance/fees`, `/api/finance/payments`,
  `/api/finance/invoices`
- Finance writes: `POST /api/finance/payments`, `/api/finance/invoices`;
  administrators update tuition with `PATCH /api/classes/{id}/fee`
- School life reads: `GET /api/school-life/announcements`,
  `/api/school-life/library`, `/api/school-life/library/borrowed`,
  `/api/school-life/timetable`, `/api/school-life/messages`
- School life writes: `POST /api/school-life/announcements`,
  `/api/school-life/library`, `/api/school-life/library/{id}/borrow`,
  `/api/school-life/library/returns/{id}`, `/api/school-life/timetable`,
  `/api/school-life/messages`
- Settings/reports: `GET`, `PUT /api/settings`; `GET /api/reports`

Protected endpoints require an `Authorization` header with a Bearer JWT.
Collection endpoints support an optional `limit` query parameter (maximum
500). Write endpoints validate input and enforce role and record ownership.
Teacher and optional student accounts can be created from the frontend;
passwords are hashed server-side. Parent accounts are created by an
administrator and linked to students using the parent's email address.

Fee payments entered in the application are records; there is no payment
processor integration. Email/SMS delivery for school notifications is not
configured; SMTP is used only for initial administrator verification.
MongoDB transactions used for registration, payment, and fee-schedule updates
require a replica set; Atlas provides this.

## Optional demo seed

Demo sample records are never added automatically and are refused in
production. In a non-production environment, set `DEMO_PASSWORD` to a private
password of at least 12 characters, then run `npm.cmd run seed:demo`. This
creates fictional records and accounts for development only. Do not use demo
data for real student or payment records.

## Checks

```powershell
npm.cmd run check
```

The check validates JavaScript syntax without requiring a live MongoDB
connection.
