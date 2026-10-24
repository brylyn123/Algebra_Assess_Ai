# Deploying AlgebraAssess

**Architecture:** React frontend on **Vercel** · PHP API + MySQL on **Railway** · uploads stored on a Railway volume.

Your code is already cloud-ready: the API reads `DB_*` / `DEEPSEEK_*` / `SMTP_*` from environment variables, and `cors.php` already allows `*.vercel.app` and `*.railway.app`.

---

## Step 1 — Push to GitHub

Commit and push the new deployment files:

```
Dockerfile
docker-entrypoint.sh
.railwayignore is not needed; railway.toml is used
.dockerignore
railway.toml
algebra-api/.env.example
```

```bash
git add Dockerfile docker-entrypoint.sh .dockerignore railway.toml algebra-api/.env.example .gitignore algebra-api/auth.php
git commit -m "Add Railway deployment config and cross-site session fix"
git push
```

## Step 2 — Backend on Railway (~10 min)

1. Go to [railway.app](https://railway.app) → **Login with GitHub** → **New Project** → **Empty Project**.
2. **+ New → GitHub Repo** → select `Algebra_Assess_Ai`. Railway finds the `Dockerfile` at the repo root and builds the PHP API.
3. **+ New → Database → MySQL.** Railway creates the DB and injects its connection variables.
4. Open the **backend service → Variables** tab and add:

   | Key | Value |
   |---|---|
   | `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
   | `DB_USER` | `${{MySQL.MYSQLUSER}}` |
   | `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}} |
   | `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
   | `DB_PORT` | `${{MySQL.MYSQLPORT}}` |

   Also add your AI + email keys: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, and optionally `SMTP_USERNAME` / `SMTP_PASSWORD` (see `algebra-api/.env.example` for the full list).

5. **Backend service → Settings → Volume:** Add Volume → Mount path `/var/www/html/uploads`, size **1 GB**, same region as the MySQL instance. (This keeps student uploads across deploys.)
6. **Settings → Networking → Public Networking → Generate Domain** — e.g. `algebra-assess-ai.up.railway.app`.
7. Click **Redeploy** so env vars and the volume take effect. Test: open `https://<your-domain>/check_deps.php` → should show `Imagick: YES`.

## Step 3 — Import the database

1. On the **MySQL service → Data tab → Query**, connect to the `algebra_learning_system` database.
2. Open `database.sql`. The first two lines (`CREATE DATABASE` / `USE`) can be skipped — Railway already created the database. Run the rest of the file (from `DROP TABLE ...` onward). If the full file is pasted at once and the first line errors, that's fine — everything after it still runs.
3. If you also maintain `database_patch.sql` on top of `database.sql`, run it after.

## Step 4 — Frontend on Vercel (~5 min)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the same GitHub repo.
2. **Settings → General → Root Directory:** `my-app` (this makes Vercel ignore the root `vercel.json` and use `my-app/vercel.json`).
3. Framework preset auto-detects **Vite** — leave the default build command.
4. **Settings → Environment Variables:** add
   ```
   VITE_API_BASE_URL = https://<your-railway-domain>
   ```
   **No trailing slash.** (This bakes the API URL into the build.)
5. **Deploy.**

## Step 5 — Smoke test the live app

1. Sign up a **teacher**, create a subject (note the join code).
2. Sign up a **student**, join with the code (tests sessions/cookies across domains).
3. Student: submit an assessment with a photo upload (tests the Railway volume).
4. Teacher: grade and return it (tests the AI key, if set).
5. Log out and log back in.

---

## Notes

- **Users are logged out when the backend redeploys** — PHP sessions live in the container. Expected and harmless.
- **Custom domains:** point a domain at Railway and Vercel, then add your frontend origin to the allowlist in `algebra-api/cors.php`.
- **Costs:** Railway is usage-based (roughly $5/month minimum); Vercel's free tier is enough for this app.
- **Never commit** `.env` or `ai_secrets.local.php` — they are gitignored; put production secrets in Railway variables only.
- `auth.php` now sends the session cookie with `SameSite=None; Secure` in production so the Vercel site and Railway API share the login session across domains.
