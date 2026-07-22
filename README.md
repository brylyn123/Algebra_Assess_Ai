# Algebra Assess AI

A web-based algebra assessment platform that allows teachers to create assessments, students to submit handwritten solutions, and uses AI (DeepSeek + Tesseract OCR) to automatically grade submissions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6 |
| Backend | PHP (procedural), MySQL via XAMPP |
| AI Grading | DeepSeek API, Tesseract OCR |
| Auth | PHP sessions with bcrypt |

## Prerequisites

- **PHP** 7.4+ (8.0+ recommended)
- **MySQL** 8.0.19+ or MariaDB 10.5+
- **Node.js** 16+ and npm
- **XAMPP** (or equivalent Apache + MySQL stack)
- **Tesseract OCR** (for handwritten text extraction)

## Setup

### 1. Database

1. Start MySQL via XAMPP.
2. Create the database:
   ```sql
   CREATE DATABASE algebraassess;
   ```
3. Import the schema:
   ```bash
   mysql -u root algebraassess < database.sql
   ```

### 2. Backend (PHP API)

1. Navigate to the API directory:
   ```bash
   cd algebra-api
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your database credentials:
   ```
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=algebraassess
   DB_PORT=3306
   ```

4. Copy the AI secrets template:
   ```bash
   cp ai_secrets.local.example.php ai_secrets.local.php
   ```

5. Edit `ai_secrets.local.php` with your DeepSeek API key.

### 3. Frontend (React)

1. Navigate to the frontend directory:
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

4. Open `http://localhost:5173` in your browser.

## Project Structure

```
Algebra_Assess_Ai/
├── algebra-api/          # PHP backend API
│   ├── auth.php          # Session authentication
│   ├── cors.php          # CORS headers
│   ├── db_connect.php    # Database connection
│   ├── schema_utils.php  # Schema migration utilities
│   ├── ai_client.php     # AI grading pipeline
│   └── uploads/          # Student file uploads
├── my-app/               # React frontend
│   ├── src/
│   │   ├── App.jsx       # Route definitions
│   │   ├── pages/        # Page components
│   │   └── components/   # Reusable components
│   └── vite.config.js    # Vite configuration
├── database.sql          # Full database schema
└── README.md
```

## API Endpoints

### Authentication
- `POST /login.php` - User login
- `POST /signup.php` - User registration
- `POST /logout.php` - User logout

### Teacher
- `GET /get_subjects.php` - List active subjects
- `POST /add_subject.php` - Create a subject
- `POST /archive_subject.php` - Archive a subject
- `POST /create_assessment.php` - Create an assessment
- `POST /delete_assessment.php` - Delete an assessment
- `POST /create_rubric.php` - Create a rubric
- `POST /save_submission_grade.php` - Save grade for a submission
- `POST /return_assessment_results.php` - Return grades to students

### Student
- `POST /enroll_subject.php` - Enroll in a subject
- `GET /get_student_assessments.php` - List assessments
- `POST /submit_assessment.php` - Submit files for an assessment

### Admin
- `POST /modify_college_course.php` - Manage colleges and courses
- `POST /reset_user_password.php` - Reset user password

## Security Features

- **Prepared statements** for all SQL queries (SQL injection prevention)
- **CSRF tokens** on all state-changing endpoints
- **Role-based access control** (admin, teacher, student)
- **Session authentication** with `HttpOnly` and `SameSite=Lax` cookies
- **MIME type validation** on file uploads (not just extension checking)
- **File upload restrictions**: 10MB limit, JPG/PNG/PDF only
- **PHP execution blocked** in uploads directory via `.htaccess`
- **Input validation** on signup, assessments, and rubrics
- **Error messages sanitized** - no internal details exposed to clients

## Production Deployment

### 1. Environment

Set up a production `.env` file:
```
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=algebraassess
```

### 2. PHP Configuration

Ensure these PHP settings:
```ini
session.cookie_secure = 1
session.cookie_httponly = 1
session.cookie_samesite = Lax
upload_max_filesize = 10M
post_max_size = 12M
```

### 3. Web Server (Apache/Nginx)

- Point document root to the project directory
- Ensure `mod_rewrite` is enabled (Apache)
- Configure HTTPS with a valid SSL certificate
- Block access to `.env`, `.git`, and sensitive files

### 4. Frontend Build

```bash
cd my-app
npm run build
```

Serve the `dist/` directory alongside the PHP API.

### 5. Database

- Use a non-root MySQL user with limited privileges
- Enable regular backups
- Set up SSL connections if database is remote

## Demo Credentials

After running `php algebra-api/seed_demo_data.php`:

| Role | Email | Password |
|------|-------|----------|
| Teacher | demo.teacher@algebra.local | DemoTeacher123! |
| Student | demo.student@algebra.local | DemoStudent123! |

## Recommended Improvements

- Add automated tests (PHPUnit for backend, Jest/Vitest for frontend)
- Implement a proper PHP routing framework (Slim, Laravel)
- Add rate limiting on API endpoints
- Implement CSRF token refresh mechanism
- Add comprehensive logging and monitoring
- Set up CI/CD pipeline
- Add Docker support for consistent development environments
