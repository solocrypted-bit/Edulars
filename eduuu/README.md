# EDULARS

EDULARS is a browser-based school management application. The frontend and
Node.js API are separate projects: the frontend is in `eduuu/` and the backend
is in the sibling `eduuu-api/` folder. Authenticated requests use JWT tokens;
school records are loaded from and saved through the MongoDB-backed API.

## Run locally on Windows

### Start the backend

Open PowerShell in `eduuu-api/` and run:

```powershell
npm.cmd ci
npm.cmd run dev
```

The API listens on `http://localhost:5000`. It requires a working MongoDB URI
and a `JWT_SECRET` of at least 32 characters in the backend's private `.env`.
The server does not fall back to in-memory records when MongoDB is unavailable.
See [`eduuu-api/README.md`](../eduuu-api/README.md) for setup and deployment.

### Start the frontend

Double-click `Run EDULARS.vbs` to launch the frontend at
http://127.0.0.1:5500/main.html. The backend allows both localhost frontend
origins in development. Alternatively, open `eduuu/` in Visual Studio Code and
use Live Server.

The frontend defaults to the local API when opened from `localhost` or
`127.0.0.1`. When deployed, it uses the Render service URL
`https://edulars-api.onrender.com/api`. If the service uses a custom URL, set
`window.EDULARS_API_URL` before `js/data.js` loads in `main.html`, for example:

```html
<script>window.EDULARS_API_URL = 'https://your-api-host.example/api';</script>
```

Add the deployed frontend's exact origin to the backend's `FRONTEND_URL`
setting. Do not include a path or trailing slash.

## Welcome, sign-in, and first administrator

The welcome screen leads to sign-in or first-time school registration. Before
an administrator exists, the registration form collects the administrator's
name, email, password, school name, and optional school logo. The API sends an
email verification link; after verification, the account can sign in to the
administrator dashboard. The verified school name and uploaded logo appear on
the sign-in page.

Admin registration is a one-time bootstrap: once an active administrator
exists, public administrator registration is closed. Configure the backend's
SMTP variables and `PUBLIC_FRONTEND_URL` before using signup. Until email
delivery is configured, the API reports that verification is unavailable;
signup does not create an account or display a local verification link.

Administrators can create classes and teacher accounts in the frontend.
Student records can also be created there; providing a student email and a
password of at least 12 characters creates a student login. Passwords are
hashed by the API before MongoDB storage. The existing `seed:admin` command
remains an alternative for trusted, non-interactive initial setup; if used,
public admin signup is already closed.

Parent accounts can be created by an authenticated administrator through
`POST /api/users` with role `parent`. Set the student's parent email to that
account's email to link the parent to the student record.

## Frontend features and persistence

- **Administrator:** dashboard, student and teacher directories, classes,
  tuition schedules, lesson-plan review, fee payments and invoices, library,
  timetable, announcements, reports, and settings.
- **Teacher:** assigned classes and students, attendance, assignments,
  assignment responses, lesson plans, and announcements.
- **Student:** assignments and submissions, grades, timetable, lesson plans,
  attendance, library, fees, and announcements.
- **Parent:** child profile, grades, attendance, fees, invoices, announcements,
  and messages to the child's teachers.

Directory, assignment, attendance, lesson-plan, fee, invoice, library,
timetable, message, announcement, and settings mutations use authenticated API
requests. A successful UI save is followed by a reload from the API; failed
requests are shown as errors rather than treated as saved. Authentication
tokens are kept in `sessionStorage` and cleared on logout.

Fee payments entered through this interface are administrative/parent records;
the application does not currently integrate a payment processor. Email/SMS
delivery is also not configured.

## Project layout

```text
eduuu/
├── main.html                  App shell and JavaScript loading order
├── main.js                    Loads HTML component fragments
├── components/                Login, navigation, content, and modal markup
└── js/
    ├── data.js                API client, application state, role menus
    ├── login.js               API authentication and session handling
    ├── navigation.js          Route selection and page rendering
    └── pages/                 Role-specific frontend screens

eduuu-api/
├── src/models/                Mongoose schemas
├── src/routes/                Authentication, read, and write API routes
├── src/services/              Role and record access rules
└── README.md                  Backend setup, deployment, and API details
```

The frontend has no build step or `package.json`; it loads its presentation
libraries from CDNs. The backend requires Node.js 20 or newer. Swagger is
available at `/api/docs` and the OpenAPI JSON at `/api-docs-json`.
