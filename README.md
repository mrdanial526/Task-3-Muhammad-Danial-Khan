# DecodeLabs Project 3: The Persistent Vault API

> **Enterprise Backend RESTful API & Relational Database Architecture**  
> Engineered with **Relational Geometry (1:1, 1:Many, M:M)**, **Native Precompiled Prepared Statements**, **ACID Transactions**, **Database-Level Constraint Shields**, and **100% Parameterized Query Immunity**.

---

## 🏛️ Architecture Overview & The Four Pillars

The Persistent Vault API serves as the digital security vault bridging application code and persistent storage with uncompromising integrity and security.

```
                    ┌──────────────────────────────────────────────┐
                    │      HTTP Clients / Web Cockpit Dashboard    │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │      Pillar 3: The Action (RESTful Router)   │
                    │  [GET, POST, PUT, PATCH, DELETE] + Envelope  │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │       Pillar 4: Gatekeeper & Sanitizer       │
                    │   Zod Schema Validation + Rate Limiter (IP)  │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │       Pillar 2: The Bridge (Native Driver)   │
                    │  better-sqlite3 + WAL Mode + ACID Tx Engine  │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │     Pillar 1 & 4: Relational Database Shield │
                    │  PK, FK (CASCADE), UNIQUE, NOT NULL, CHECK   │
                    │      1:1  │  1:Many  │  Many-to-Many (M:M)   │
                    └──────────────────────────────────────────────┘
```

---

## 📐 Pillar 1: The Blueprint (Schema & Relational Geometry)

### 1. One-to-One (1:1) Geometry: Users ⟷ User Profiles
Enforces strict exclusivity where each `users` account owns exactly one `user_profiles` record. Enforced at the engine level via a `UNIQUE` foreign key constraint:
```sql
CREATE TABLE user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,  -- Enforces strict 1:1 exclusivity
    full_name TEXT NOT NULL,
    clearance_level INTEGER NOT NULL DEFAULT 1 CHECK(clearance_level BETWEEN 1 AND 5),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2. One-to-Many (1:Many) Geometry: Users ⟶ Folders/Items & Customers ⟶ Orders
- **Vault Hierarchy**: A single user owns multiple `vault_folders` and multiple `vault_items`.
- **E-Commerce Tracking**: A single `customers` record connects to multiple `orders` records.
```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

### 3. Many-to-Many (M:M) Geometry: Vault Items ⟷ Tags & Students ⟷ Courses
- **Vault Item Tags**: Multiple vault items map to multiple tags via junction table `vault_item_tags` with a composite primary key `(vault_item_id, tag_id)`.
- **Academic Enrollments**: Multiple students enroll in multiple courses via junction table `student_courses` with a composite primary key `(student_id, course_id)`.
```sql
CREATE TABLE student_courses (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(grade IN ('A', 'B', 'C', 'D', 'F', 'IN_PROGRESS')),
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
```

---

## 🌉 Pillar 2: The Bridge (Integration & Connection)

- **Native High-Speed SQLite Driver (`better-sqlite3`)**: Direct synchronous execution bypassing asynchronous runtime overhead.
- **Write-Ahead Logging (WAL)**: `PRAGMA journal_mode = WAL` enables concurrent multi-client read and write operations.
- **Foreign Key Enforcement**: `PRAGMA foreign_keys = ON` strictly verified on connection bootstrap.
- **Atomic Transactions**: Multi-table insertions and cascade synchronizations execute within `db.transaction(...)` blocks ensuring ACID compliance.

---

## ⚡ Pillar 3: The Action (CRUD & RESTful HTTP)

| HTTP Method | Endpoint | SQL Mapping | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/users` | `INSERT INTO users`, `INSERT INTO user_profiles` | Create User & 1:1 Profile in Atomic Tx |
| `GET` | `/api/v1/users` | `SELECT ... JOIN user_profiles ...` | List users with profile details & stats |
| `GET` | `/api/v1/users/:id` | `SELECT ... WHERE u.id = ?` | Retrieve single user with joined profile |
| `PUT / PATCH` | `/api/v1/users/:id` | `UPDATE users`, `UPDATE user_profiles` | Modify user credentials & profile |
| `DELETE` | `/api/v1/users/:id` | `DELETE FROM users WHERE id = ?` | Cascades deletion to profile, items & tags |
| `GET` | `/api/v1/items` | `SELECT ... JOIN ... GROUP BY` | List items with aggregated M:M tags |
| `POST` | `/api/v1/items` | `INSERT INTO vault_items`, `INSERT INTO vault_item_tags` | Store secret with M:M tags |
| `PUT` | `/api/v1/items/:id` | `UPDATE vault_items`, `DELETE/INSERT vault_item_tags` | Update secret & synchronize M:M tags |
| `DELETE` | `/api/v1/items/:id` | `DELETE FROM vault_items WHERE id = ?` | Delete secret (cascades junction rows) |
| `GET` | `/api/v1/academics/students` | `SELECT ... (SELECT json_group_array(...))` | List students with joined courses (M:M) |
| `POST` | `/api/v1/academics/enroll` | `INSERT INTO student_courses` | Enroll student in course via junction |
| `GET` | `/api/v1/commerce/customers` | `SELECT ... SUM(o.total_amount)` | Customers with lifetime order stats (1:Many) |
| `POST` | `/api/v1/security/injection-sandbox` | `SELECT ... WHERE username = ?` | SQL Injection Defense Simulator |

---

## 🛡️ Pillar 4: The Shield (Integrity & Security)

### 1. Schema-Level Constraints
- **`UNIQUE`**: Prevents duplicate usernames, emails, order numbers, and enforces 1:1 profile uniqueness (`user_profiles.user_id`).
- **`NOT NULL`**: Mandates presence of critical fields (passwords, emails, titles, payloads).
- **`CHECK`**: Enforces business constraints at the database level:
  - `role IN ('ADMIN', 'OFFICER', 'AUDITOR', 'OPERATOR')`
  - `clearance_level BETWEEN 1 AND 5`
  - `sensitivity_score BETWEEN 1 AND 100`
  - `total_amount >= 0`
  - `gpa BETWEEN 0.0 AND 4.0`
  - `credits BETWEEN 1 AND 6`

### 2. Zero-Vulnerability Parameterized Queries
Every user-supplied value is passed as an isolated parameter (`?`) to SQLite precompiled statements:
```javascript
// SECURE: Parameterized Query
const safeResults = db.query('SELECT * FROM users WHERE username = ?', [userInput]);
```
Hostile payloads like `' OR '1'='1`, `admin' --`, and `'; DROP TABLE users; --` are treated solely as literal strings, neutralizing 100% of SQL injection attempts.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended, tested on Node v24.20)
- npm (v9+)

### Installation
```bash
# Clone or navigate to the project directory
cd "E:\Projects\decodelabs-3rd Task"

# Install dependencies
npm install
```

### Database Initialization & Seeding
```bash
# Apply schema DDL (creates tables, views, indexes)
npm run migrate

# Populate database with rich seed data
npm run seed

# Or reset & re-seed in one command
npm run db:reset
```

### Start the Server
```bash
# Production start
npm start

# Development mode (with file watcher)
npm run dev
```
- 🌐 **Web Cockpit UI**: `http://localhost:3000/`
- 🛡️ **REST API Base**: `http://localhost:3000/api/v1`

---

## 🧪 Automated Test Suite (54 Assertions)

Run the comprehensive test runner verifying all 4 pillars, relational geometries, CRUD cycles, constraints, and SQL injection attack vectors:
```bash
npm test
```

### Test Coverage Highlights:
- ✅ **Pillar 1**: 1:1 User Profile join, 1:Many items/orders, M:M tag and course junctions.
- ✅ **Pillar 2**: PRAGMA foreign keys, WAL mode, transaction atomicity.
- ✅ **Pillar 3**: Complete REST CRUD operations with proper HTTP status codes (`200`, `201`, `400`, `404`, `409`, `422`).
- ✅ **Pillar 4**: `UNIQUE` duplicate conflicts (`409`), `CHECK` invalid bounds (`400`/`422`), `FOREIGN KEY` missing parent references (`404`/`409`).
- ✅ **SQL Injection Shield**: Tests auth bypass `' OR 1=1 --`, comment truncation `admin' --`, destructive drop `'; DROP TABLE users; --`, and `UNION` attacks.
- ✅ **Relational Cascade**: Verifies `ON DELETE CASCADE` automatically purges child profiles, folders, items, and junction records.
- ✅ **Database Health**: Verifies `PRAGMA integrity_check` and `PRAGMA foreign_key_check` return 0 violations.

---

## 📁 Project Directory Structure

```
decodelabs-3rd Task/
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── index.js                     # Main server entry point
├── src/
│   ├── config/
│   │   └── env.js              # Validated environment configuration (Zod)
│   ├── database/
│   │   ├── schema.sql          # DDL Blueprint (1:1, 1:N, M:M, CHECK, UNIQUE, PK, FK)
│   │   ├── db.js               # SQLite Native Bridge & Transaction Engine
│   │   ├── migrate.js          # Migration runner
│   │   └── seedData.js         # Realistic seed dataset
│   ├── controllers/
│   │   ├── userController.js   # 1:1 User & Profile CRUD
│   │   ├── itemController.js   # 1:Many Items & M:M Tag Synchronization
│   │   ├── folderController.js # 1:Many Folders CRUD
│   │   ├── tagController.js    # Classification Tags CRUD
│   │   ├── academicController.js # Students ⟷ Courses M:M Domain
│   │   ├── commerceController.js # Customers ⟶ Orders 1:Many Domain
│   │   ├── securityController.js # SQL Injection Defense Sandbox
│   │   └── systemController.js # Health, Integrity & Metrics
│   ├── middleware/
│   │   ├── errorHandler.js     # Centralized Error & Constraint Handler
│   │   ├── requestLogger.js    # Correlation ID (X-Request-Id) Tracer
│   │   ├── rateLimiter.js      # Sliding-Window Rate Limiter
│   │   └── validator.js        # Syntactic Gatekeeper (Zod)
│   ├── schemas/
│   │   ├── userSchema.js
│   │   ├── itemSchema.js
│   │   ├── folderSchema.js
│   │   ├── tagSchema.js
│   │   ├── academicSchema.js
│   │   └── commerceSchema.js
│   ├── utils/
│   │   ├── apiResponse.js      # Standardized Response Envelope
│   │   ├── crypto.js           # Password Hashing & Secret Masking
│   │   └── logger.js           # Console Logger
│   ├── public/
│   │   ├── index.html          # Interactive Web Cockpit Dashboard
│   │   ├── style.css           # Glassmorphism Dark Theme
│   │   └── app.js              # Live Cockpit Controller
│   └── tests/
│       └── run-tests.js        # 54 Automated Test Assertions
└── data/
    └── vault.db                # Persistent SQLite Storage
```

---

## 📜 License
MIT License • Created for **DecodeLabs Project 3: The Persistent Vault API**.
