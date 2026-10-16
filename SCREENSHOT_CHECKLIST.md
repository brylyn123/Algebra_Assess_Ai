# System Screenshot Checklist

Capture list for attaching to the system documentation.
Run the frontend (`npm run dev` in `my-app/`, opens at `http://localhost:5173`) or the built version served via Apache.
Suggested capture size: 1920×1080, browser window without tabs/URL bar if possible.

## Public / Auth (no login)

- [ ] **1. Landing page** — `/` — hero section, feature highlights
- [ ] **2. Login** — `/login` — login form
- [ ] **3. Sign up** — `/signup` — registration form (teacher/student roles)
- [ ] **4. Reset password** — `/reset-password` — request/reset form

## Teacher / Admin (login as teacher or admin → `/dashboard`)

- [ ] **5. Overview** — `/dashboard` — stats cards, recent activity
- [ ] **6. Manage Subjects** — `/dashboard/subjects` — subject grid with card themes
- [ ] **7. Subject Details** — `/dashboard/subjects/:id` — joined students, subject assessments
- [ ] **8. Catalog (admin only)** — `/dashboard/catalog` — course / section / year level management
- [ ] **9. Manage Assessments** — `/dashboard/assessments` — assessment list per subject
- [ ] **10. View Assessments** — `/dashboard/assessments/view` — assessment preview
- [ ] **11. New Assessment** — `/dashboard/assessments/new` — assessment builder form
- [ ] **12. Edit Assessment** — `/dashboard/assessments/edit/:id` — builder in edit mode
- [ ] **13. Question Editor** — `/dashboard/assessments/edit-questions` — mathlive math editor + KaTeX preview
- [ ] **14. Rubric Builder** — `/dashboard/assessments/new-rubric` — custom grading criteria editor
- [ ] **15. Grade Submissions** — `/dashboard/grade-submissions` — student submissions, AI grading result with criteria scores
- [ ] **16. Reports** — `/dashboard/reports` — class performance analytics
- [ ] **17. Profile** — `/dashboard/profile` — teacher account info
- [ ] **18. Settings** — `/dashboard/settings` — preferences

## Student (login as student → `/student`)

- [ ] **19. Overview** — `/student` — student dashboard
- [ ] **20. My Subjects** — `/student/subjects` — joined subjects + join-code entry
- [ ] **21. Subject Detail** — `/student/subjects/:id` — available assessments for the subject
- [ ] **22. Submit Assessment** — `/student/submit` — answer inputs (text/image/PDF), legibility check
- [ ] **23. Reports** — `/student/reports` — grades and AI feedback per submission
- [ ] **24. Profile** — `/student/profile` — student account info

## Extra in-page states (recommended)

- [ ] **A. Join-code success modal** — after creating a subject (screen 6)
- [ ] **B. AI item-extraction dialog** — during assessment creation, after uploading a file (screen 11)
- [ ] **C. Custom rubric criteria list** — grading criteria editor with weighted criteria (screen 14)
- [ ] **D. AI criteria-score breakdown** — graded submission with per-criterion scores (screen 15)
- [ ] **E. Image legibility warning** — after uploading a low-quality answer image (screen 22)
- [ ] **F. Notification bell** — expanded notification dropdown (any dashboard)

## Notes

- Use test accounts with realistic data (at least 1 subject, 1 published assessment, 1 graded submission) so screens are not empty.
- Screen 8 is admin-only; hide or skip if capturing as a teacher.
- Screens 11–14 can be captured from the same draft assessment flow in one sitting.
- Screens 15 and 23 show the same graded submission from teacher and student views — capture both for contrast.
