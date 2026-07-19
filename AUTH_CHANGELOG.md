# Auth Change Log

## Current updates

- `algebra-api/login.php`
  - Trims the submitted email before lookup.
  - Verifies passwords using `password_verify()` for modern bcrypt hashes.
  - Falls back to a legacy plaintext comparison for older accounts.
  - Rehashes legacy plaintext passwords after a successful login.

- `algebra-api/reset_user_password.php`
  - Adds an authenticated password-reset endpoint.
  - Allows teacher/admin sessions to reset a user's password by email.
  - Stores the new password as a bcrypt hash.

- `my-app/src/signup.js` and `algebra-api/signup.php`
  - Removes the student self-service "Add new course" path.
  - Requires students to choose from admin-provided courses only.
  - Rejects student sign-ups when no courses exist yet.

- `my-app/src/signup.js` and `algebra-api/signup.php`
  - Removes the teacher self-service "Add new college" path.
  - Requires teachers to choose from admin-provided colleges only.
  - Rejects teacher sign-ups when no colleges exist yet.

- `my-app/src/AdminCatalog.js`, `my-app/src/App.js`, and `my-app/src/dashboard.js`
  - Adds an admin-only catalog screen for managing colleges and courses.
  - Exposes the screen from the dashboard shell with a `Catalog` nav item.
  - Keeps the admin management work out of the signup flow.

- `algebra-api/get_catalog.php` and `algebra-api/modify_college_course.php`
  - Adds a proper admin catalog data endpoint.
  - Fixes college/course maintenance to use the real schema columns.
  - Restricts catalog changes to admin sessions only.

## Why this was needed

- The live password row we checked was truncated and could not be verified correctly.
- New signups already hash passwords properly, but older or damaged rows can still break login.
- Courses should be controlled by staff, not created during student registration.
- Colleges should be controlled by staff, not created during teacher registration.
- The admin catalog should be the single place where staff manage those lookup values.

## Recommended next steps

- Use the new reset endpoint to set a fresh password for the affected account.
- If the broken account has no important data, you can delete and recreate it instead.
- Keep this file updated whenever auth behavior changes so it stays easy to track.
