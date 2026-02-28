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

The server listens on `PORT` (default 3000). On startup it runs pending [Sequelize migrations](#database-and-migrations) so the schema stays up to date.

## Database and migrations

Schema and new tables are managed with Sequelize migrations (no `sync`).

- **`db/config.js`** — Database config for the CLI (reads from `.env`).
- **`db/migrations/`** — Migration files. New tables or columns go here.
- **`db/seeders/`** — Optional seed data.

**Commands**

- Run pending migrations (also runs automatically on `npm start`):
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

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- **Courses:** `GET/POST /api/courses`, `GET/PUT/DELETE /api/courses/:id`, `POST /api/courses/:id/enroll`
- **Lessons:** `GET/POST /api/courses/:courseId/lessons`, `GET/PUT/DELETE /api/courses/:courseId/lessons/:id`
- **Enrollments:** `GET /api/enrollments` (my enrollments), `GET /api/enrollments/:id`, `PUT /api/enrollments/:id` (e.g. progress), `DELETE /api/enrollments/:id` (unenroll)
- **Users:** `GET /api/users/me`, `PUT /api/users/me`

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
