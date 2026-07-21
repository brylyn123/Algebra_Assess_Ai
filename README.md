# Algebra Assess AI

This repository contains a React frontend (`my-app`) and a PHP/MySQL backend (`algebra-api`) for an algebra assessment platform.

## Setup

### Backend
1. Copy `algebra-api/.env.example` to `algebra-api/.env`.
2. Update the database settings and AI settings in `algebra-api/.env`.
3. Copy `algebra-api/ai_secrets.local.example.php` to `algebra-api/ai_secrets.local.php` and set your AI provider credentials.

### Frontend
1. Change into the frontend directory:
   ```bash
   cd my-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Notes

- The backend loads environment variables from `algebra-api/.env` when present.
- Sensitive local files are ignored by `.gitignore`.
- If you deploy to production, do not commit `.env` or `ai_secrets.local.php`.
- The frontend proxies requests to `/algebra-api` via `my-app/vite.config.js`.

## Recommended improvements

- Add ESLint / Prettier to the frontend.
- Add a backend router or shared API utilities to reduce duplicate PHP code.
- Add tests for critical API endpoints and UI workflows.
- Use HTTPS and secure session cookies in production.
