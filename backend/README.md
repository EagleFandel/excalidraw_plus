# Excalidraw+ Backend

This backend provides auth, personal/team file APIs, and basic team management.

## Tech Stack

- NestJS + TypeScript
- Prisma + PostgreSQL
- JWT (HttpOnly Cookie)
- Argon2 password hashing

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Update `DATABASE_URL`, `JWT_SECRET`, and cookie/CORS settings.

3. Install dependencies from repo root:

```bash
yarn install
```

4. Generate Prisma client and run migrations:

```bash
yarn --cwd backend prisma:generate
yarn --cwd backend prisma:migrate --name init_users
yarn --cwd backend prisma:migrate --name add_files
yarn --cwd backend prisma:migrate --name add_teams_and_file_lifecycle
```

5. Start backend:

```bash
yarn start:backend
```

Server default: `http://localhost:3005/api`

## Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/files?scope=personal|team`
- `POST /api/files`
- `GET /api/files/:id`
- `PUT /api/files/:id`
- `DELETE /api/files/:id`
- `POST /api/files/:id/restore`
- `DELETE /api/files/:id/permanent`
- `PATCH /api/files/:id/favorite`
- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/:id/members`
- `POST /api/teams/:id/members`
- `PATCH /api/teams/:id/members/:userId`
- `DELETE /api/teams/:id/members/:userId`
- `GET /api/health`

## Notes

- Auth cookie name defaults to `excplus-auth`.
- Frontend should call `/auth/me` on startup with `credentials: include`.
- E2E checklist base URL defaults to `http://localhost:3005/api`.
