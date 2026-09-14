# CRM Project Setup Guide

> Simple CRM — sirf 4 modules: **Dashboard**, **Attendance**, **Inbox**, **Meetings**  
> Frontend: **Next.js + Tailwind CSS + JavaScript**  
> Backend: **PHP (API)**  
> Database: **MySQL (XAMPP)**

---

## 1. Project Goal

Ek chhota CRM banana hai jisme:

| # | Module      | Kaam |
|---|-------------|------|
| 1 | Dashboard   | Summary cards, aaj ki attendance, upcoming meetings, unread inbox |
| 2 | Attendance  | Check-in / check-out, daily / monthly attendance list |
| 3 | Inbox       | Internal messages / notifications read & mark as read |
| 4 | Meetings    | Meeting create, list, update status (scheduled / done / cancelled) |

Frontend aur Backend **alag-alag folders** mein honge. Frontend UI dikhayega, Backend API + DB handle karega.

---

## 2. Folder Structure (Separate Frontend & Backend)

Root: `c:\xampp\htdocs\CRM`

```
CRM/
├── bi_docs/                 # Documentation (yeh folder)
│   └── 01-crm-setup-guide.md
│
├── frontend/                # Next.js app (UI)
│   ├── app/
│   │   ├── layout.js
│   │   ├── page.js              # Dashboard
│   │   ├── attendance/
│   │   │   └── page.js
│   │   ├── inbox/
│   │   │   └── page.js
│   │   └── meetings/
│   │   │       └── page.js
│   ├── components/
│   │   ├── Sidebar.js
│   │   ├── Navbar.js
│   │   └── cards/
│   ├── lib/
│   │   └── api.js               # Backend API calls
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── backend/                 # PHP API
    ├── public/
    │   └── index.php            # Entry / router
    ├── config/
    │   └── database.php         # DB connection
    ├── api/
    │   ├── dashboard.php
    │   ├── attendance.php
    │   ├── inbox.php
    │   └── meetings.php
    ├── cors.php                 # CORS headers for Next.js
    └── .htaccess                (optional)
```

**Rule:** Frontend kabhi seedha DB touch nahi karega. Har data PHP API se aayega.

---

## 3. Tech Stack Summary

| Layer     | Technology              | Port / URL (local)              |
|-----------|-------------------------|---------------------------------|
| Frontend  | Next.js 14+ (App Router), Tailwind, JS | `http://localhost:3000` |
| Backend   | PHP 8+ (XAMPP Apache)   | `http://localhost/CRM/backend/public/` |
| Database  | MySQL (phpMyAdmin)      | `localhost` / DB name: `crm_db` |

---

## 4. Setup — Step by Step

### 4.1 Prerequisites

1. **XAMPP** install ho (Apache + MySQL)
2. **Node.js** LTS install ho (`node -v` / `npm -v` check karo)
3. Browser + VS Code / Cursor

### 4.2 Database Setup (pehle yeh)

1. XAMPP Control Panel se **Apache** aur **MySQL** start karo
2. Browser: `http://localhost/phpmyadmin`
3. New database banao: `crm_db`
4. Neeche wala SQL run karo (phpMyAdmin → SQL tab)

```sql
CREATE DATABASE IF NOT EXISTS crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crm_db;

-- Users (login baad mein; abhi basic)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  check_in DATETIME NULL,
  check_out DATETIME NULL,
  date DATE NOT NULL,
  status ENUM('present', 'absent', 'late', 'half_day') DEFAULT 'present',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_date (user_id, date)
);

-- Inbox (messages / notifications)
CREATE TABLE inbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Meetings
CREATE TABLE meetings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  meeting_date DATETIME NOT NULL,
  location VARCHAR(200) NULL,
  created_by INT NOT NULL,
  status ENUM('scheduled', 'done', 'cancelled') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed demo user (password: password123 — baad mein hash se replace karna)
INSERT INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@crm.local', 'password123', 'admin');
```

### 4.3 Backend Setup (PHP)

1. Folder banao: `c:\xampp\htdocs\CRM\backend`
2. `config/database.php` — MySQL connection:

```php
<?php
$host = 'localhost';
$db   = 'crm_db';
$user = 'root';
$pass = ''; // XAMPP default empty
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
  PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];

try {
  $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['error' => 'DB connection failed']);
  exit;
}
```

3. `cors.php` — Next.js (`localhost:3000`) ke liye:

```php
<?php
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}
```

4. Har API file pehle `cors.php` + `database.php` include karegi.
5. Test URL example:  
   `http://localhost/CRM/backend/api/dashboard.php`

### 4.4 Frontend Setup (Next.js + Tailwind)

PowerShell / terminal mein:

```bash
cd c:\xampp\htdocs\CRM
npx create-next-app@latest frontend
```

Prompts ke jawab (recommended):

- TypeScript? → **No**
- ESLint? → Yes
- Tailwind CSS? → **Yes**
- `src/` directory? → No (ya Yes — consistent raho)
- App Router? → **Yes**
- Turbopack? → optional
- Import alias? → default `@/*`

Phir:

```bash
cd frontend
npm run dev
```

Browser: `http://localhost:3000`

API helper (`lib/api.js`):

```js
const API_BASE = 'http://localhost/CRM/backend/api';

export async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}/${endpoint}`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export async function apiPost(endpoint, data) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}
```

---

## 5. Frontend Kaise Banaye

### 5.1 Layout

- Left **Sidebar**: Dashboard | Attendance | Inbox | Meetings
- Top **Navbar**: page title + user name
- Main area: har page ka content

Files:

- `components/Sidebar.js`
- `components/Navbar.js`
- `app/layout.js` — Sidebar + Navbar wrap

### 5.2 Pages

| Route            | File                      | UI idea |
|------------------|---------------------------|---------|
| `/`              | `app/page.js`             | Stats cards + recent lists |
| `/attendance`    | `app/attendance/page.js`  | Check-in button + table |
| `/inbox`         | `app/inbox/page.js`       | Message list + mark read |
| `/meetings`      | `app/meetings/page.js`    | Form + meetings table |

### 5.3 Styling

- Tailwind utility classes use karo
- Simple, clean CRM look (sidebar dark / light, white content)
- Responsive: mobile pe sidebar collapse (baad mein)

### 5.4 Data Flow (Frontend)

```
Page load → lib/api.js → PHP endpoint → JSON → UI render
Button click (e.g. Check-in) → apiPost → PHP insert/update → refresh list
```

---

## 6. Backend Kaise Set Karo

### 6.1 API Endpoints (Phase 1)

| Method | Endpoint              | Purpose |
|--------|-----------------------|---------|
| GET    | `dashboard.php`       | Counts: today attendance, unread inbox, upcoming meetings |
| GET    | `attendance.php`      | List attendance (optional `?user_id=1`) |
| POST   | `attendance.php`      | Check-in / check-out |
| GET    | `inbox.php`           | List messages for user |
| PUT    | `inbox.php`           | Mark as read (`id`) |
| GET    | `meetings.php`        | List meetings |
| POST   | `meetings.php`        | Create meeting |
| PUT    | `meetings.php`        | Update status |

### 6.2 Response Format (standard)

Success:

```json
{
  "success": true,
  "data": { }
}
```

Error:

```json
{
  "success": false,
  "error": "Something went wrong"
}
```

### 6.3 Example — `attendance.php` flow

1. Include `cors.php` + `database.php`
2. Agar `GET` → SELECT rows → `json_encode`
3. Agar `POST` → JSON body read → INSERT / UPDATE check_in or check_out
4. Always JSON return

---

## 7. Build Order (Kis Order Mein Kaam Karo)

Is order mein karo — confuse nahi hoga:

1. **DB** banao + tables + seed user  
2. **Backend** `database.php` + `cors.php`  
3. **Backend** ek test API (`dashboard.php` dummy JSON)  
4. **Frontend** Next.js + Tailwind create  
5. **Frontend** Sidebar + 4 empty pages  
6. **Connect** frontend `api.js` se dummy dashboard  
7. **Attendance** API + page (check-in)  
8. **Inbox** API + page  
9. **Meetings** API + page  
10. **Dashboard** real counts se connect  
11. (Optional baad mein) Login / auth

---

## 8. Local Run Checklist

Har baar project chalate waqt:

- [ ] XAMPP → Apache ON  
- [ ] XAMPP → MySQL ON  
- [ ] Backend URL browser mein open hoti hai (JSON dikhe)  
- [ ] `cd frontend` → `npm run dev`  
- [ ] `http://localhost:3000` open  

---

## 9. Next Docs (baad mein)

Jab setup clear ho jaye, next MD files bana sakte ho:

- `02-database-schema.md` — tables detail  
- `03-api-contracts.md` — har endpoint request/response  
- `04-frontend-pages.md` — UI wireframes / components  
- `05-auth-plan.md` — login (optional phase 2)

---

## 10. Short Reminder

| Do | Don't |
|----|--------|
| Frontend ↔ Backend sirf HTTP JSON | Frontend se seedha MySQL |
| Alag folders: `frontend/` + `backend/` | Sab ek hi Next.js folder mein PHP mix |
| Pehle DB + 1 API test | Pehle hi saari UI perfect banana |
| CORS allow `localhost:3000` | CORS bhool kar fetch fail |

---

**Shuruat:** Section **4.2 Database** se start karo, phir **4.3 Backend**, phir **4.4 Frontend**.
