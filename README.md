# Shana Beginners Backend

Node.js/Express API for an e-learning platform. Uses PostgreSQL with Sequelize, JWT authentication with HTTP-only cookie refresh tokens, and role-based access (student, instructor, admin).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a PostgreSQL database**

   ```bash
   createdb shana_elearning
   ```

   Or using `psql`:

   ```sql
   CREATE DATABASE shana_elearning;
   ```

3. **Configure environment**

   Copy the example below into a `.env` file in the project root and set your database credentials and secrets:

   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=shana_elearning
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your_access_token_secret
   JWT_REFRESH_SECRET=your_refresh_token_secret
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   ```

## Run

- Development (with auto-reload):

  ```bash
  npm run dev
  ```

- Production:

  ```bash
  npm start
  ```

The server listens on `PORT` (default 3000). It does **not** run migrations on startup — run `npm run db:setup` after pulling schema or curriculum changes.

## First-time setup and after every pull

```bash
npm run db:setup      # migrations + curriculum load, in the right order (safe to re-run)
npm run db:seed:demo  # optional: demo accounts for local testing (refuses NODE_ENV=production)
```

`db:setup` runs the migrations up to the curriculum tables, loads the curriculum, then
runs the rest (the curriculum foreign keys need the curriculum loaded first). Running it
again is a no-op when nothing changed.

### Demo accounts (`npm run db:seed:demo`)

| Role in the app | Email | Password | Notes |
|---|---|---|---|
| Admin (backend role `admin`) | trainer@shana.dev | Trainer123 | Uploads and assigns modules |
| Trainer (backend role `instructor`) | coach@shana.dev | Coach1234 | Reviews submissions, tracks progress |
| Student, beginner | ava@shana.dev | Ava12345 | All 24 beginner modules assigned |
| Student, advanced | leo@shana.dev | Leo12345 | All 3 advanced modules assigned |

## Curriculum

The curriculum (modules, lessons, exercises) is authored in the frontend repo and
exported here as **`db/curriculum/curriculum.json`**:

```bash
# in shana-e-learning-beginners
npm run export:curriculum
# then here
npm run db:seed:curriculum -- --dry-run   # preview what would change
npm run db:seed:curriculum                # apply
```

It is stored in three tables:

- **`CurriculumModules`** — the source of truth: one row per module, with `lessons` holding
  the frontend's `Lesson[]` exactly as authored (JSONB). `source` is `curriculum` (from the
  export) or `admin` (built in the app); the seed never touches `admin` modules.
- **`CurriculumLessons`**, **`CurriculumExercises`** — lookup rows derived from `lessons`
  on every write (never edit them by hand). They enforce that lesson and exercise ids are
  unique across the whole curriculum, and give progress, reward and submission rows a
  real foreign key target.

Content that disappears from the export is **archived** (`archivedAt`), never deleted, so
students keep the progress and rewards they earned. Changed content gets a new `version`;
a module that only moved in the list does not. The seed runs in one transaction and
refuses the whole file — writing nothing — if anything is invalid, listing every problem.

`StarLogs.exerciseId` intentionally has no foreign key: the story-tabs activity awards
bonus stars against synthetic ids (`<questionId>__starter`).

## Staff accounts

Public signup creates **students only**. Create Admin and Trainer accounts with:

```bash
npm run staff:create -- --email jo@school.org --first Jo --last Mensah --role admin
npm run staff:create -- --email kofi@school.org --first Kofi --last Boateng --role trainer
```

The password comes from `STAFF_PASSWORD` if set; otherwise a strong one is generated and
printed once.

## Tests

```bash
npm run test:curriculum   # curriculum store, foreign keys, signup rules, demo logins (needs the server running)
npm run test:auth         # register → login blocked until email verified → verify → login/refresh (needs the server running)
```

`test:curriculum` rolls back everything it writes and deletes the one account it creates.

## Database and migrations

Schema and new tables are managed with Sequelize migrations (no `sync`).

- **`db/config.js`** — Database config for the CLI (reads from `.env`).
- **`db/migrations/`** — Migration files. New tables or columns go here.
- **`db/curriculum/`** — Curriculum export loaded by `npm run db:seed:curriculum`.
- **`backups/`** — Local `pg_dump` backups (git-ignored — they contain password hashes).

**Commands**

- Run pending migrations (prefer `npm run db:setup`, which also loads the curriculum):
  ```bash
  npm run db:migrate
  ```
- Undo the last migration:
  ```bash
  npm run db:migrate:undo
  ```
- Show migration status:
  ```bash
  npm run db:migrate:status
  ```
- Generate a new migration (add a new table or change):
  ```bash
  npm run db:migrate:generate add-posts-table
  ```
  Then edit the new file in `db/migrations/` with `up` / `down` logic.

If the database already has tables from an older setup, either run migrations on a fresh database or [baseline](https://sequelize.org/docs/v6/other-topics/migrations/#baselining) by inserting the existing migration names into `SequelizeMeta`.

## API Overview

- **Auth:** `POST /api/auth/register` (students only), `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/verify-email`, `POST /api/auth/resend-verification`
- **Users:** `GET /api/users/me`, `PUT /api/users/me`
- **Students:** `GET /api/students`, `GET/PUT/DELETE /api/students/:id`
- **Progress & rewards:** `/api/progress/*`
- **Assignments:** `/api/assignments/*`
- **Tasks:** `/api/tasks/*`
- **Payments:** `/api/payments/*`

Curriculum read/write endpoints (`/api/modules`) arrive in the next phase. The full,
current list is in `docs/openapi.json` (served at `/docs`).

Use the `Authorization: Bearer <accessToken>` header for protected routes. The refresh token is sent via an HTTP-only cookie and used by `POST /api/auth/refresh`.

## Testing with Swagger or Postman

### Swagger (browser)

1. Start the server: `npm start`
2. Open **http://localhost:3000/docs** in your browser.
3. Try **POST /api/auth/login** (or register) with body:
   ```json
   { "email": "your@email.com", "password": "yourpassword" }
   ```
4. Copy the `accessToken` from the response.
5. Click **Authorize**, enter `Bearer <paste your token>` (or just the token if the UI adds “Bearer” for you), then **Authorize**.
6. Call any protected endpoint from the Swagger UI; the token is sent automatically.

The OpenAPI spec is in `docs/openapi.json`; you can edit it to add more request/response details.

### Postman

1. **Base URL:** `http://localhost:3000` (set as a variable if you like).
2. **Get a token:**  
   **POST** `{{baseUrl}}/api/auth/login`  
   Body → raw → JSON:
   ```json
   { "email": "your@email.com", "password": "yourpassword" }
   ```
   Copy the `accessToken` from the response.
3. **Use the token:**  
   For protected routes, add a header:  
   **Key:** `Authorization`  
   **Value:** `Bearer <your accessToken>`  
   Or use the **Authorization** tab → Type: **Bearer Token** → paste the token.
4. **Refresh token:**  
   **POST** `{{baseUrl}}/api/auth/refresh` (no body).  
   Postman will send the cookie set by login; the response returns a new `accessToken`. Update the Bearer token for later requests.
5. **Optional:** Import `docs/openapi.json` in Postman (Import → Link or file) to get a collection with all endpoints.
