# AlgebraAssess System

A web-based algebra assessment system featuring a Vite-powered React frontend and a MySQL backend via XAMPP.

## 🛠 Prerequisites

Before you begin, ensure you have the following installed:
* **Node.js** (v14 or higher)
* **XAMPP** (with Apache and MySQL modules)
* **Git**

## 🚀 Getting Started

### 1. Database Setup (XAMPP)
1. Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.
2. Go to [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
3. Create a new database named `algebraassess`.
4. Import the `database.sql` file from the project root to set up the tables.
5. Run the demo seeder from the project root to create sample accounts and demo data:
   ```bash
   php algebra-api/seed_demo_data.php
   ```

### 2. Backend Setup
1. Make sure Apache serves the project root so the backend API is available at `http://localhost/Algebra_Assess_Ai/algebra-api`.
2. The backend uses the `algebraassess` database and default XAMPP MySQL credentials in `algebra-api/db_connect.php`.
3. If your database credentials differ, update `algebra-api/db_connect.php` accordingly.

### 3. Frontend Setup (Vite React)
1. Clone the repository:
   ```bash
   git clone <your-github-repo-link>
   ```
2. Change into the frontend directory:
   ```bash
   cd my-app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open the app in your browser at `http://localhost:5173`.

### 4. Demo Credentials
Use the seeded demo accounts to log in quickly:

* Teacher: `demo.teacher@algebra.local` / `DemoTeacher123!`
* Student: `demo.student@algebra.local` / `DemoStudent123!`

### Notes
* The frontend proxies `/algebra-api` requests to the PHP backend via `my-app/vite.config.js`.
* If you build the app for production, deploy the generated `dist` folder alongside the `algebra-api` backend so the API path remains accessible.
