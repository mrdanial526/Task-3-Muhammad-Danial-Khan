const bcrypt = require('bcryptjs');
const { getDatabase, close } = require('./db');
const { runMigrations } = require('./migrate');

function seed(options = {}) {
  const db = getDatabase(options.customDbPath);

  console.log('[SEED] Seeding database with realistic Vault, Academic, and E-Commerce records...');

  const passwordHash = bcrypt.hashSync('VaultAdmin@2026', 8);

  const tx = db.transaction(() => {
    // Clear existing data safely
    db.exec(`
      DELETE FROM vault_item_tags;
      DELETE FROM audit_logs;
      DELETE FROM vault_items;
      DELETE FROM vault_folders;
      DELETE FROM user_profiles;
      DELETE FROM users;
      DELETE FROM tags;
      DELETE FROM student_courses;
      DELETE FROM students;
      DELETE FROM courses;
      DELETE FROM orders;
      DELETE FROM customers;
    `);

    // 1. Seed Users & Profiles (One-to-One 1:1)
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertProfile = db.prepare(`
      INSERT INTO user_profiles (user_id, full_name, avatar_url, bio, clearance_level, phone_number, emergency_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const usersData = [
      {
        id: 1,
        username: 'cyber_admin',
        email: 'admin@persistentvault.internal',
        role: 'ADMIN',
        status: 'ACTIVE',
        profile: {
          fullName: 'Dr. Evelyn Vance',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          bio: 'Chief Security Officer & Cryptographic Vault Custodian',
          clearanceLevel: 5,
          phone: '+1-555-0199',
          emergencyCode: 'ALPHA-99-OMEGA'
        }
      },
      {
        id: 2,
        username: 'marcus_officer',
        email: 'marcus.k@persistentvault.internal',
        role: 'OFFICER',
        status: 'ACTIVE',
        profile: {
          fullName: 'Marcus Kane',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          bio: 'Senior Security Operations Officer',
          clearanceLevel: 4,
          phone: '+1-555-0144',
          emergencyCode: 'BRAVO-44-SIGMA'
        }
      },
      {
        id: 3,
        username: 'sarah_auditor',
        email: 'sarah.audit@persistentvault.internal',
        role: 'AUDITOR',
        status: 'ACTIVE',
        profile: {
          fullName: 'Sarah Chen',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
          bio: 'Compliance & Forensic Vault Auditor',
          clearanceLevel: 3,
          phone: '+1-555-0178',
          emergencyCode: 'GAMMA-78-DELTA'
        }
      },
      {
        id: 4,
        username: 'david_operator',
        email: 'david.op@persistentvault.internal',
        role: 'OPERATOR',
        status: 'ACTIVE',
        profile: {
          fullName: 'David Thorne',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
          bio: 'Data Infrastructure Operator',
          clearanceLevel: 2,
          phone: '+1-555-0122',
          emergencyCode: 'EPSILON-22-THETA'
        }
      }
    ];

    for (const u of usersData) {
      insertUser.run(u.id, u.username, u.email, passwordHash, u.role, u.status);
      insertProfile.run(
        u.id,
        u.profile.fullName,
        u.profile.avatarUrl,
        u.profile.bio,
        u.profile.clearanceLevel,
        u.profile.phone,
        u.profile.emergencyCode
      );
    }

    // 2. Seed Vault Folders (One-to-Many 1:Many from Users)
    const insertFolder = db.prepare(`
      INSERT INTO vault_folders (id, user_id, name, description, color_code, icon, is_locked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const foldersData = [
      { id: 1, userId: 1, name: 'Root Infrastructure Secrets', description: 'Core cloud master keys and database credentials', colorCode: '#EF4444', icon: 'shield-alert', isLocked: 1 },
      { id: 2, userId: 1, name: 'API Integrations & Webhooks', description: 'Payment gateways and third-party SaaS tokens', colorCode: '#3B82F6', icon: 'key-round', isLocked: 0 },
      { id: 3, userId: 2, name: 'Operational Certificates', description: 'mTLS keys, SSL/TLS certificates and renewal tokens', colorCode: '#10B981', icon: 'file-lock', isLocked: 0 },
      { id: 4, userId: 3, name: 'Compliance Records', description: 'Quarterly cryptographic audits and SOC2 reports', colorCode: '#8B5CF6', icon: 'clipboard-check', isLocked: 0 }
    ];

    for (const f of foldersData) {
      insertFolder.run(f.id, f.userId, f.name, f.description, f.colorCode, f.icon, f.isLocked);
    }

    // 3. Seed Tags
    const insertTag = db.prepare(`
      INSERT INTO tags (id, name, color_hex)
      VALUES (?, ?, ?)
    `);

    const tagsData = [
      { id: 1, name: 'Production', colorHex: '#DC2626' },
      { id: 2, name: 'Critical', colorHex: '#EA580C' },
      { id: 3, name: 'Automated-Rotation', colorHex: '#2563EB' },
      { id: 4, name: 'Payment-Gateway', colorHex: '#059669' },
      { id: 5, name: 'Cloud-GCP', colorHex: '#4F46E5' },
      { id: 6, name: 'Database', colorHex: '#D97706' }
    ];

    for (const t of tagsData) {
      insertTag.run(t.id, t.name, t.colorHex);
    }

    // 4. Seed Vault Items (1:Many from Users/Folders)
    const insertItem = db.prepare(`
      INSERT INTO vault_items (id, user_id, folder_id, title, secret_type, encrypted_payload, sensitivity_score, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const itemsData = [
      {
        id: 1,
        userId: 1,
        folderId: 1,
        title: 'Production PostgreSQL Master Connection String',
        secretType: 'LOGIN',
        encryptedPayload: 'enc_aes256_gcm$99f8a3bc89d10e:postgres://superadmin:sample_mock_pass_2026@prod-db.internal:5432/primary_vault',
        sensitivityScore: 98,
        expiresAt: '2027-12-31 23:59:59'
      },
      {
        id: 2,
        userId: 1,
        folderId: 1,
        title: 'Cloud Service Account IAM Private Key',
        secretType: 'API_KEY',
        encryptedPayload: 'enc_aes256_gcm$44d8e9ac0184aa:{"type":"service_account","project_id":"decodelabs-vault-prod","private_key_id":"mock_key_7fa141ba"}',
        sensitivityScore: 95,
        expiresAt: '2026-11-30 00:00:00'
      },
      {
        id: 3,
        userId: 1,
        folderId: 2,
        title: 'Payment Gateway Integration Token',
        secretType: 'API_KEY',
        encryptedPayload: 'enc_aes256_gcm$11ba43fe9902bc:gateway_vault_token_mock_test_key_string_9948271',
        sensitivityScore: 88,
        expiresAt: null
      },
      {
        id: 4,
        userId: 2,
        folderId: 3,
        title: 'Wildcard *.persistentvault.com TLS Certificate',
        secretType: 'DOCUMENT',
        encryptedPayload: 'enc_aes256_gcm$88de47a11009ce:-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0VaultSecretKey...\n-----END RSA PRIVATE KEY-----',
        sensitivityScore: 82,
        expiresAt: '2026-10-15 12:00:00'
      },
      {
        id: 5,
        userId: 3,
        folderId: 4,
        title: 'SOC2 Type II Annual Security Attestation',
        secretType: 'SECURE_NOTE',
        encryptedPayload: 'enc_aes256_gcm$77ff32da8811bc:Audit Completed by Ernst & Crypt Security Labs. Zero critical non-conformances found.',
        sensitivityScore: 65,
        expiresAt: '2027-01-01 00:00:00'
      }
    ];

    for (const item of itemsData) {
      insertItem.run(
        item.id,
        item.userId,
        item.folderId,
        item.title,
        item.secretType,
        item.encryptedPayload,
        item.sensitivityScore,
        item.expiresAt
      );
    }

    // 5. Seed Vault Item Tags (Many-to-Many M:M Junction)
    const insertItemTag = db.prepare(`
      INSERT INTO vault_item_tags (vault_item_id, tag_id)
      VALUES (?, ?)
    `);

    const itemTagsData = [
      { itemId: 1, tagId: 1 }, // Prod Master DB -> Production
      { itemId: 1, tagId: 2 }, // Prod Master DB -> Critical
      { itemId: 1, tagId: 6 }, // Prod Master DB -> Database
      { itemId: 2, tagId: 1 }, // Cloud SA -> Production
      { itemId: 2, tagId: 5 }, // Cloud SA -> Cloud-GCP
      { itemId: 2, tagId: 3 }, // Cloud SA -> Automated-Rotation
      { itemId: 3, tagId: 1 }, // Payment Gateway -> Production
      { itemId: 3, tagId: 4 }, // Payment Gateway -> Payment-Gateway
      { itemId: 4, tagId: 2 }, // TLS Cert -> Critical
      { itemId: 4, tagId: 3 }  // TLS Cert -> Automated-Rotation
    ];

    for (const it of itemTagsData) {
      insertItemTag.run(it.itemId, it.tagId);
    }

    // 6. Seed Audit Logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const auditData = [
      { userId: 1, action: 'VAULT_BOOTSTRAP', entityType: 'SYSTEM', entityId: 1, ip: '127.0.0.1', status: 'SUCCESS', details: 'Initial cryptographic master keys and schema generated' },
      { userId: 1, action: 'SECRET_CREATED', entityType: 'VAULT_ITEM', entityId: 1, ip: '192.168.1.100', status: 'SUCCESS', details: 'Created Production Master Secret' },
      { userId: 2, action: 'SECRET_ACCESSED', entityType: 'VAULT_ITEM', entityId: 4, ip: '192.168.1.105', status: 'SUCCESS', details: 'TLS Certificate decrypted for nginx reload' },
      { userId: 3, action: 'AUDIT_INSPECTION', entityType: 'VAULT_FOLDER', entityId: 4, ip: '192.168.1.120', status: 'SUCCESS', details: 'Compliance verification scan completed' }
    ];

    for (const a of auditData) {
      insertAudit.run(a.userId, a.action, a.entityType, a.entityId, a.ip, a.status, a.details);
    }

    // 7. Seed Academics Domain (Students <-> Courses M:M)
    const insertStudent = db.prepare(`
      INSERT INTO students (id, student_code, full_name, email, enrollment_year, gpa)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const studentsData = [
      { id: 1, code: 'STU-2024-001', name: 'Alex Rivera', email: 'alex.rivera@university.edu', year: 2024, gpa: 3.85 },
      { id: 2, code: 'STU-2024-002', name: 'Brianna Hayes', email: 'brianna.h@university.edu', year: 2024, gpa: 3.92 },
      { id: 3, code: 'STU-2025-003', name: 'Cyrus Sterling', email: 'cyrus.s@university.edu', year: 2025, gpa: 3.45 },
      { id: 4, code: 'STU-2025-004', name: 'Diana Prince', email: 'diana.p@university.edu', year: 2025, gpa: 4.00 }
    ];

    for (const s of studentsData) {
      insertStudent.run(s.id, s.code, s.name, s.email, s.year, s.gpa);
    }

    const insertCourse = db.prepare(`
      INSERT INTO courses (id, course_code, title, credits, department)
      VALUES (?, ?, ?, ?, ?)
    `);

    const coursesData = [
      { id: 1, code: 'CS-401', title: 'Relational Database Architecture & Internals', credits: 4, department: 'Computer Science' },
      { id: 2, code: 'SEC-502', title: 'Applied Cryptography & Vault Security', credits: 3, department: 'Cybersecurity' },
      { id: 3, code: 'DS-303', title: 'Data Structures and Distributed Storage', credits: 4, department: 'Computer Science' },
      { id: 4, code: 'AI-601', title: 'Advanced Neural Information Retrieval', credits: 3, department: 'Artificial Intelligence' }
    ];

    for (const c of coursesData) {
      insertCourse.run(c.id, c.code, c.title, c.credits, c.department);
    }

    const insertStudentCourse = db.prepare(`
      INSERT INTO student_courses (student_id, course_id, grade)
      VALUES (?, ?, ?)
    `);

    const enrollments = [
      { studentId: 1, courseId: 1, grade: 'A' },
      { studentId: 1, courseId: 2, grade: 'A' },
      { studentId: 2, courseId: 1, grade: 'A' },
      { studentId: 2, courseId: 3, grade: 'B' },
      { studentId: 3, courseId: 2, grade: 'IN_PROGRESS' },
      { studentId: 3, courseId: 3, grade: 'IN_PROGRESS' },
      { studentId: 4, courseId: 1, grade: 'A' },
      { studentId: 4, courseId: 2, grade: 'A' },
      { studentId: 4, courseId: 4, grade: 'A' }
    ];

    for (const e of enrollments) {
      insertStudentCourse.run(e.studentId, e.courseId, e.grade);
    }

    // 8. Seed E-Commerce Domain (Customers -> Orders 1:Many)
    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, customer_code, name, email, phone, loyalty_tier)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const customersData = [
      { id: 1, code: 'CUST-1001', name: 'Acme Optical Solutions', email: 'procurement@acmeoptical.com', phone: '+1-800-555-0101', tier: 'PLATINUM' },
      { id: 2, code: 'CUST-1002', name: 'Lumos Vision Clinic', email: 'orders@lumosvision.org', phone: '+1-800-555-0102', tier: 'GOLD' },
      { id: 3, code: 'CUST-1003', name: 'Horizon Eyewear Labs', email: 'supply@horizoneye.io', phone: '+1-800-555-0103', tier: 'SILVER' }
    ];

    for (const cust of customersData) {
      insertCustomer.run(cust.id, cust.code, cust.name, cust.email, cust.phone, cust.tier);
    }

    const insertOrder = db.prepare(`
      INSERT INTO orders (id, order_number, customer_id, total_amount, status, shipping_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const ordersData = [
      { id: 1, orderNumber: 'ORD-2026-8801', customerId: 1, totalAmount: 4850.00, status: 'COMPLETED', address: '742 Evergreen Terrace, Springfield, IL' },
      { id: 2, orderNumber: 'ORD-2026-8802', customerId: 1, totalAmount: 12400.50, status: 'COMPLETED', address: '742 Evergreen Terrace, Springfield, IL' },
      { id: 3, orderNumber: 'ORD-2026-8803', customerId: 2, totalAmount: 3200.00, status: 'PROCESSING', address: '100 Metro Health Plaza, Suite 400, Chicago, IL' },
      { id: 4, orderNumber: 'ORD-2026-8804', customerId: 3, totalAmount: 950.00, status: 'PENDING', address: '88 Innovation Way, Austin, TX' }
    ];

    for (const ord of ordersData) {
      insertOrder.run(ord.id, ord.orderNumber, ord.customerId, ord.totalAmount, ord.status, ord.address);
    }
  });

  tx();
  console.log('[SEED] ✅ Seeding completed successfully.');
  return true;
}

if (require.main === module) {
  try {
    runMigrations();
    seed();
    close();
  } catch (err) {
    console.error('[SEED] ❌ Seeding failed:', err);
    process.exit(1);
  }
}

module.exports = { seed };
