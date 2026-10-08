-- ============================================================================
-- DecodeLabs Project 3: The Persistent Vault API
-- Database Blueprint (DDL) with Relational Geometry & Constraints
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. USERS & PROFILES (Demonstrates One-to-One / 1:1 Relational Geometry)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OPERATOR' CHECK(role IN ('ADMIN', 'OFFICER', 'AUDITOR', 'OPERATOR')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SUSPENDED', 'PENDING')),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    clearance_level INTEGER NOT NULL DEFAULT 1 CHECK(clearance_level BETWEEN 1 AND 5),
    phone_number TEXT,
    emergency_code TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 2. VAULT FOLDERS (Demonstrates One-to-Many / 1:Many Relational Geometry)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_code TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT 'folder-key',
    is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. VAULT ITEMS (Demonstrates 1:Many from User/Folder and M:M with Tags)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    folder_id INTEGER,
    title TEXT NOT NULL,
    secret_type TEXT NOT NULL DEFAULT 'SECURE_NOTE' CHECK(secret_type IN ('LOGIN', 'SECURE_NOTE', 'CREDIT_CARD', 'API_KEY', 'DOCUMENT')),
    encrypted_payload TEXT NOT NULL,
    sensitivity_score INTEGER NOT NULL DEFAULT 50 CHECK(sensitivity_score BETWEEN 1 AND 100),
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES vault_folders(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 4. TAGS & VAULT_ITEM_TAGS (Demonstrates Many-to-Many / M:M Junction Table)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color_hex TEXT NOT NULL DEFAULT '#10B981' CHECK(color_hex LIKE '#%' AND length(color_hex) = 7),
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vault_item_tags (
    vault_item_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (vault_item_id, tag_id),
    FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 5. AUDIT LOGS (Demonstrates Append-Only Vault Access Journaling)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS', 'FAILURE', 'BLOCKED')),
    details TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 6. ACADEMICS DOMAIN (Demonstrates Students <-> Courses Many-to-Many)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    enrollment_year INTEGER NOT NULL CHECK(enrollment_year >= 2000),
    gpa REAL NOT NULL DEFAULT 3.00 CHECK(gpa BETWEEN 0.0 AND 4.0),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    credits INTEGER NOT NULL CHECK(credits BETWEEN 1 AND 6),
    department TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_courses (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_date DATETIME NOT NULL DEFAULT (datetime('now')),
    grade TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(grade IN ('A', 'B', 'C', 'D', 'F', 'IN_PROGRESS')),
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 7. E-COMMERCE DOMAIN (Demonstrates Customer -> Orders One-to-Many)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    loyalty_tier TEXT NOT NULL DEFAULT 'BRONZE' CHECK(loyalty_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
    shipping_address TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR HIGH QUERY EFFICIENCY
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_folders_user_id ON vault_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON vault_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_folder_id ON vault_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_secret_type ON vault_items(secret_type);
CREATE INDEX IF NOT EXISTS idx_vault_item_tags_tag ON vault_item_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);

-- ----------------------------------------------------------------------------
-- COMPOSITE VIEWS FOR EFFICIENT REPORTING & RELATIONAL JOINS
-- ----------------------------------------------------------------------------

CREATE VIEW IF NOT EXISTS v_vault_items_expanded AS
SELECT 
    i.id,
    i.user_id,
    u.username AS owner_username,
    u.email AS owner_email,
    p.full_name AS owner_full_name,
    p.clearance_level AS owner_clearance,
    i.folder_id,
    f.name AS folder_name,
    f.color_code AS folder_color,
    i.title,
    i.secret_type,
    i.encrypted_payload,
    i.sensitivity_score,
    i.expires_at,
    i.created_at,
    i.updated_at,
    (
        SELECT json_group_array(
            json_object(
                'id', t.id,
                'name', t.name,
                'color_hex', t.color_hex,
                'assigned_at', vit.assigned_at
            )
        )
        FROM vault_item_tags vit
        JOIN tags t ON vit.tag_id = t.id
        WHERE vit.vault_item_id = i.id
    ) AS tags_json
FROM vault_items i
JOIN users u ON i.user_id = u.id
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN vault_folders f ON i.folder_id = f.id;

CREATE VIEW IF NOT EXISTS v_customer_order_summaries AS
SELECT 
    c.id AS customer_id,
    c.customer_code,
    c.name,
    c.email,
    c.loyalty_tier,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS lifetime_spent,
    MAX(o.created_at) AS latest_order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id;
