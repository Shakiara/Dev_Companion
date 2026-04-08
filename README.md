# Dev Companion

Dev Companion is a full stack web application for organizing projects, ideas, errors, and notes in one workspace.

It includes:

- a frontend built with HTML, CSS, and vanilla JavaScript
- a backend built with Node.js and Express
- authentication with local accounts plus Google and GitHub OAuth
- an admin panel for monitoring users and activity
- MySQL-ready architecture with local JSON fallback storage for development

## What This Project Demonstrates

- frontend structure and UI styling
- interactive client-side JavaScript
- REST API design
- CRUD operations
- JSON request and response handling
- backend validation and error handling
- authentication and admin-only routes
- MySQL integration
- Docker support

## Main Features

- Dashboard with project, idea, error, and note summary
- Modules for `Projects`, `Ideas`, `Errors`, and `Notes`
- Local sign in and account creation
- Sign in with Google
- Sign in with GitHub
- Admin-only user monitor
- Admin password reset for local accounts
- Admin deletion of regular users and their related workspace content
- Activity logging for sign-ins and tracked workspace actions

---

## Live Deployment

- Portfolio: https://shakiara.github.io/MyPortafolio/
- Dev Companion: N/A
The repository now includes a GitHub Pages workflow to publish the site automatically from main.

---

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express
- MySQL
- Docker

## Project Structure

```text
dev-companion/
├── backend/
│   ├── app.js
│   │   Main Express server. Serves the frontend, mounts auth/API/admin routes,
│   │   and starts the app on the configured host and port.
│   ├── config/
│   │   └── db.js
│   │       Creates and exports the MySQL pool when DB credentials are available.
│   ├── controllers/
│   │   ├── admin.controller.js
│   │   │   Handles admin monitoring, password reset, and user deletion.
│   │   ├── api.controller.js
│   │   │   Small general API responses such as status/info routes.
│   │   ├── auth.controller.js
│   │   │   Handles login, register, logout, session checks, and OAuth callbacks.
│   │   ├── dashboard.controller.js
│   │   │   Returns summary data for the dashboard.
│   │   ├── errors.controller.js
│   │   │   CRUD logic for error entries.
│   │   ├── ideas.controller.js
│   │   │   CRUD logic for ideas.
│   │   ├── notes.controller.js
│   │   │   CRUD logic for notes.
│   │   └── projects.controller.js
│   │       CRUD logic for projects.
│   ├── data/
│   │   ├── activity-log.json
│   │   │   Local fallback log of tracked workspace actions.
│   │   ├── auth-log.json
│   │   │   Local fallback log of sign-ins and registrations.
│   │   ├── fallback-db.json
│   │   │   Local fallback storage for projects, ideas, errors, and notes.
│   │   ├── fileStore.js
│   │   │   Read/write helpers for fallback JSON storage.
│   │   └── users.json
│   │       Local fallback storage for users.
│   ├── middleware/
│   │   ├── requireAdmin.js
│   │   │   Blocks admin-only routes unless the session belongs to admin.
│   │   └── requireAuth.js
│   │       Blocks protected routes unless the user is authenticated.
│   ├── routes/
│   │   ├── admin.routes.js
│   │   │   Admin endpoints for monitoring, resetting passwords, and deleting users.
│   │   ├── api.routes.js
│   │   │   General API routes.
│   │   ├── auth.routes.js
│   │   │   Login, register, logout, session, Google, and GitHub auth routes.
│   │   ├── dashboard.routes.js
│   │   │   Dashboard summary endpoints.
│   │   ├── errors.routes.js
│   │   │   Error CRUD routes.
│   │   ├── ideas.routes.js
│   │   │   Idea CRUD routes.
│   │   ├── notes.routes.js
│   │   │   Note CRUD routes.
│   │   └── projects.routes.js
│   │       Project CRUD routes.
│   ├── services/
│   │   └── dataService.js
│   │       MySQL-first data layer with fallback to JSON storage.
│   └── utils/
│   │   ├── asyncHandler.js
│   │   │   Wraps async route handlers to forward errors correctly.
│   │   ├── auth.js
│   │   │   Session helpers, password hashing, auth logs, activity logs, and user management.
│   │   └── validation.js
│   │       Validation helpers for request payloads and IDs.
├── database/
│   └── dev_companion.sql
│       SQL schema for MySQL tables and starter structure.
├── frontend/
│   ├── css/
│   │   └── style.css
│   │       All frontend styling, layout, components, and responsive rules.
│   ├── index.html
│   │   Main SPA shell with login UI, dashboard, admin panel, and CRUD sections.
│   └── js/
│       └── app.js
│           Frontend state, rendering, fetch calls, navigation, forms, filters, and admin actions.
├── postman/
│   └── dev-companion.postman_collection.json
│       Postman collection for testing the API.
├── .env.example
│   Example environment variables for local configuration.
├── docker-compose.yml
│   Docker setup for the app and MySQL together.
├── Dockerfile
│   Docker image definition for the application.
├── package.json
│   Node.js project metadata, scripts, and dependencies.
└── README.md
    Project documentation and setup guide.
```

## Authentication

The app supports:

- local account registration and login
- Google OAuth login
- GitHub OAuth login

The app also reserves one admin account:

- username: `admin`
- password: `localhost`

That account is used to access admin-only user monitoring tools.

## Admin Panel

When logged in as `admin`, the app shows a `Users` panel where admin can:

- search users by name or username
- filter by provider
- filter by specific user
- see sign-in history
- see tracked activity inside the app
- reset passwords for local accounts
- delete regular users

Important behavior:

- `admin` is not treated as a regular user in the monitor
- `admin` cannot be deleted
- deleting a regular user also deletes their related owned content from fallback storage

## Database Design

The schema is in [database/dev_companion.sql](/Users/kyarah/Documents/Dev%20Companion/database/dev_companion.sql).

### Main tables

- `projects`
- `ideas`
- `errors`
- `notes`

### Relationships

- `ideas.project_id -> projects.id`
- `errors.project_id -> projects.id`
- `notes.project_id -> projects.id`

### Ownership fields

New records also store:

- `owner_username`
- `owner_display_name`

These are used by the admin panel when removing a user and cleaning up their content.

## API Overview

### General

- `GET /`
- `GET /api`
- `GET /api/dashboard/summary`

### Auth

- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`

### Projects

- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

### Ideas

- `GET /api/ideas`
- `GET /api/ideas/:id`
- `POST /api/ideas`
- `PUT /api/ideas/:id`
- `DELETE /api/ideas/:id`

### Errors

- `GET /api/errors`
- `GET /api/errors/:id`
- `POST /api/errors`
- `PUT /api/errors/:id`
- `DELETE /api/errors/:id`

### Notes

- `GET /api/notes`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/users/:username/reset-password`
- `DELETE /api/admin/users/:username`

## How To Run Locally

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd dev-companion
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your environment file

Copy the example file:

```bash
cp .env.example .env
```

Then fill in the values you want to use.

### 4. Configure environment variables

Typical local values look like this:

```env
PORT=3000
HOST=127.0.0.1

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=dev_companion

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/api/auth/google/callback

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://127.0.0.1:3000/api/auth/github/callback
```

### 5. Optional: create the MySQL database

If you want to use MySQL instead of local fallback storage, run:

```sql
SOURCE database/dev_companion.sql;
```

If MySQL is not available, the app still runs using local JSON files in `backend/data/`.

### 6. Start the app

```bash
npm start
```

### 7. Open it in the browser

Open:

[http://127.0.0.1:3000](http://127.0.0.1:3000)

## How To Run With Docker

### 1. Build and start containers

```bash
docker compose up --build
```

### 2. Open the app

Open:

[http://localhost:3000](http://localhost:3000)

### 3. MySQL port

When using the provided Docker setup, MySQL is exposed on host port `3307`.

## Fallback Storage

If MySQL is unavailable, the backend automatically falls back to JSON files:

- [backend/data/fallback-db.json](/Users/kyarah/Documents/Dev%20Companion/backend/data/fallback-db.json)
- [backend/data/users.json](/Users/kyarah/Documents/Dev%20Companion/backend/data/users.json)
- [backend/data/auth-log.json](/Users/kyarah/Documents/Dev%20Companion/backend/data/auth-log.json)
- [backend/data/activity-log.json](/Users/kyarah/Documents/Dev%20Companion/backend/data/activity-log.json)

This is useful for development, demos, and capstone presentations.

## Validation and Error Handling

### Frontend

- required fields in forms
- inline feedback for failed actions
- confirmation before destructive deletes
- admin search and filters in the monitor

### Backend

- payload validation for CRUD routes
- validation for local register/login
- protected auth and admin middleware
- `400` for invalid requests
- `401` for unauthenticated requests
- `403` for forbidden admin access
- `404` for missing records
- `500` for unexpected server errors

## Testing

A Postman collection is included in [postman/dev-companion.postman_collection.json](/Users/kyarah/Documents/Dev%20Companion/postman/dev-companion.postman_collection.json).

Suggested manual checks:

1. Create a local account.
2. Sign in with that account.
3. Create a project, idea, error, and note.
4. Log in as dev.
5. Open the `Users` panel.
6. Verify the user appears with activity.
7. Reset the password for that local account.
8. Delete that user and confirm their owned content is removed.
