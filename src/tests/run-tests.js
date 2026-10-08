const http = require('http');
const path = require('path');
const fs = require('fs');
const { createApp } = require('../server');
const { getDatabase, close } = require('../database/db');
const { runMigrations } = require('../database/migrate');
const { seed } = require('../database/seedData');

// Color helpers
const green = '\x1b[32m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  ${green}✔${reset} ${message}`);
  } else {
    failed++;
    console.log(`  ${red}✖${reset} ${message}`);
    if (details) console.log(`    ${red}Details: ${details}${reset}`);
    failures.push({ message, details });
  }
}

/**
 * Lightweight HTTP request helper
 */
function request(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log(`\n${bold}${cyan}========================================================================${reset}`);
  console.log(`${bold}${cyan}  DecodeLabs Project 3: The Persistent Vault API - Test Suite Runner  ${reset}`);
  console.log(`${bold}${cyan}========================================================================${reset}\n`);

  // Use isolated test database
  const testDbPath = path.resolve(__dirname, '../../data/vault_test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  process.env.DATABASE_PATH = testDbPath;
  process.env.DB_ENABLE_WAL = 'true';
  process.env.DB_FOREIGN_KEYS = 'true';
  process.env.NODE_ENV = 'test';

  // Initialize fresh test database & seed
  runMigrations({ customDbPath: testDbPath, reset: true });
  seed({ customDbPath: testDbPath });

  const app = createApp();
  const server = http.createServer(app);

  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  console.log(`${yellow}⚡ Test HTTP server started on ephemeral port ${port}${reset}\n`);

  try {
    const db = getDatabase(testDbPath);

    // ------------------------------------------------------------------------
    console.log(`${bold}SECTION 1: Database Engine & Relational Blueprint (Pillar 1 & 2)${reset}`);
    // ------------------------------------------------------------------------
    const fkPragma = db.pragma('foreign_keys', { simple: true });
    assert(fkPragma === 1, 'PRAGMA foreign_keys is strictly enabled on connection');

    const journalMode = db.pragma('journal_mode', { simple: true });
    assert(journalMode.toLowerCase() === 'wal', `Write-Ahead Logging (WAL) is active (current: ${journalMode})`);

    // 1:1 User to UserProfile check
    const userWithProfile = db.prepare(`
      SELECT u.id, u.username, p.full_name, p.clearance_level
      FROM users u
      JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = 1
    `).get();
    assert(userWithProfile && userWithProfile.username === 'cyber_admin' && userWithProfile.clearance_level === 5, 'One-to-One (1:1) User to UserProfile join resolves correctly');

    // 1:Many User to VaultItems check
    const userItems = db.prepare('SELECT COUNT(*) as count FROM vault_items WHERE user_id = 1').get();
    assert(userItems.count >= 3, `One-to-Many (1:Many) User to VaultItems verified (${userItems.count} items for user 1)`);

    // M:M VaultItems to Tags junction check
    const item1Tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN vault_item_tags vit ON t.id = vit.tag_id
      WHERE vit.vault_item_id = 1
    `).all();
    assert(item1Tags.length === 3, `Many-to-Many (M:M) Vault Item 1 links to 3 tags via junction table`);

    // M:M Academic Student to Courses check
    const student1Courses = db.prepare(`
      SELECT c.course_code FROM courses c
      JOIN student_courses sc ON c.id = sc.course_id
      WHERE sc.student_id = 1
    `).all();
    assert(student1Courses.length === 2, `Many-to-Many (M:M) Student 1 is enrolled in 2 courses via student_courses`);

    // 1:Many E-Commerce Customer to Orders check
    const customer1Orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_id = 1').get();
    assert(customer1Orders.count === 2, `One-to-Many (1:Many) Customer 1 owns 2 orders`);

    // ------------------------------------------------------------------------
    console.log(`\n${bold}SECTION 2: System Health, Headers & Observability (Pillars 2 & 3)${reset}`);
    // ------------------------------------------------------------------------
    const healthRes = await request(server, 'GET', '/api/v1/system/health');
    assert(healthRes.status === 200 && healthRes.body.data.status === 'HEALTHY', 'GET /api/v1/system/health returns 200 HEALTHY');
    assert(Boolean(healthRes.headers['x-request-id']), 'Response includes correlation header X-Request-Id');
    assert(Boolean(healthRes.headers['x-ratelimit-limit']), 'Response includes rate limit header X-RateLimit-Limit');

    const metricsRes = await request(server, 'GET', '/api/v1/system/metrics');
    assert(metricsRes.status === 200 && metricsRes.body.data.totalTables === 12, `GET /api/v1/system/metrics returns accurate table count (12 active tables)`);

    const schemaRes = await request(server, 'GET', '/api/v1/system/schema');
    assert(schemaRes.status === 200 && Array.isArray(schemaRes.body.data), 'GET /api/v1/system/schema exports complete DDL metadata');

    // ------------------------------------------------------------------------
    console.log(`\n${bold}SECTION 3: CRUD & RESTful Endpoints (Pillar 3)${reset}`);
    // ------------------------------------------------------------------------
    
    // GET /api/v1/users (list with sorting)
    const listUsersRes = await request(server, 'GET', '/api/v1/users?sortBy=username&order=ASC');
    assert(listUsersRes.status === 200 && Array.isArray(listUsersRes.body.data) && listUsersRes.body.data.length >= 4, 'GET /api/v1/users returns sorted list of users');

    // POST /api/v1/users (Create User + 1:1 Profile Atomic Transaction)
    const newUserPayload = {
      username: 'agent_phoenix',
      email: 'phoenix@vault.test',
      password: 'SecurePassword123!',
      role: 'OFFICER',
      status: 'ACTIVE',
      profile: {
        fullName: 'Agent Phoenix',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Tactical Recon Officer',
        clearanceLevel: 4,
        phoneNumber: '+1-555-7788',
        emergencyCode: 'PHOENIX-99'
      }
    };
    const createUserRes = await request(server, 'POST', '/api/v1/users', newUserPayload);
    assert(createUserRes.status === 201, `POST /api/v1/users returns 201 Created`);
    assert(createUserRes.body.data.profile.fullName === 'Agent Phoenix', 'User Profile created simultaneously in atomic transaction');
    const newUserId = createUserRes.body.data.id;

    // GET /api/v1/users/:id
    const getUserRes = await request(server, 'GET', `/api/v1/users/${newUserId}`);
    assert(getUserRes.status === 200 && getUserRes.body.data.username === 'agent_phoenix', 'GET /api/v1/users/:id returns user and 1:1 profile');

    // GET /api/v1/users/:id/profile
    const getProfileRes = await request(server, 'GET', `/api/v1/users/${newUserId}/profile`);
    assert(getProfileRes.status === 200 && getProfileRes.body.data.emergency_code === 'PHOENIX-99', 'GET /api/v1/users/:id/profile returns 1:1 profile directly');

    // PATCH /api/v1/users/:id
    const patchUserRes = await request(server, 'PATCH', `/api/v1/users/${newUserId}`, {
      role: 'ADMIN',
      profile: { clearanceLevel: 5, bio: 'Promoted to Chief Vault Custodian' }
    });
    assert(patchUserRes.status === 200 && patchUserRes.body.data.role === 'ADMIN' && patchUserRes.body.data.profile.clearanceLevel === 5, 'PATCH /api/v1/users/:id updates role & profile');

    // POST /api/v1/folders
    const createFolderRes = await request(server, 'POST', '/api/v1/folders', {
      userId: newUserId,
      name: 'Phoenix Tactical Vault',
      description: 'Air-gapped tactical keys',
      colorCode: '#EF4444',
      icon: 'shield-lock',
      isLocked: 1
    });
    assert(createFolderRes.status === 201, 'POST /api/v1/folders creates folder (1:Many from User)');
    const folderId = createFolderRes.body.data.id;

    // GET /api/v1/folders/:id
    const getFolderRes = await request(server, 'GET', `/api/v1/folders/${folderId}`);
    assert(getFolderRes.status === 200 && getFolderRes.body.data.name === 'Phoenix Tactical Vault', 'GET /api/v1/folders/:id returns folder with items array');

    // PUT /api/v1/folders/:id
    const updateFolderRes = await request(server, 'PUT', `/api/v1/folders/${folderId}`, {
      name: 'Phoenix Alpha Vault (Renamed)',
      colorCode: '#8B5CF6'
    });
    assert(updateFolderRes.status === 200 && updateFolderRes.body.data.name === 'Phoenix Alpha Vault (Renamed)', 'PUT /api/v1/folders/:id updates folder metadata');

    // POST /api/v1/tags
    const createTagRes = await request(server, 'POST', '/api/v1/tags', {
      name: 'Encrypted-Alpha',
      colorHex: '#6366F1'
    });
    assert(createTagRes.status === 201, 'POST /api/v1/tags creates new tag');
    const newTagId = createTagRes.body.data.id;

    // GET /api/v1/tags
    const listTagsRes = await request(server, 'GET', '/api/v1/tags');
    assert(listTagsRes.status === 200 && listTagsRes.body.data.length >= 7, 'GET /api/v1/tags returns tags with item count');

    // POST /api/v1/items (Create Item with M:M Tags)
    const createItemRes = await request(server, 'POST', '/api/v1/items', {
      userId: newUserId,
      folderId,
      title: 'Satellite Uplink Encryption Key',
      secretType: 'API_KEY',
      payload: 'enc_satellite_master_hex_9948271',
      sensitivityScore: 92,
      tagIds: [1, 2, newTagId]
    });
    assert(createItemRes.status === 201, 'POST /api/v1/items creates secret item with M:M tags');
    const createdItemId = createItemRes.body.data.id;
    assert(createItemRes.body.data.tags.length === 3, 'Item tags successfully linked via junction table');

    // GET /api/v1/items (Filter by tag & search)
    const filterItemRes = await request(server, 'GET', `/api/v1/items?tagId=${newTagId}&search=Satellite`);
    assert(filterItemRes.status === 200 && filterItemRes.body.data.length >= 1, 'GET /api/v1/items correctly filters by tagId and search query');

    // GET /api/v1/items/:id (Masked vs Revealed)
    const getMaskedItem = await request(server, 'GET', `/api/v1/items/${createdItemId}?reveal=false`);
    assert(getMaskedItem.body.data.isMasked === true && getMaskedItem.body.data.payload.includes('•'), 'GET /api/v1/items/:id masks secret payload by default');

    const getRevealedItem = await request(server, 'GET', `/api/v1/items/${createdItemId}?reveal=true`);
    assert(getRevealedItem.body.data.isMasked === false && getRevealedItem.body.data.payload === 'enc_satellite_master_hex_9948271', 'GET /api/v1/items/:id reveals full payload when reveal=true');

    // PUT /api/v1/items/:id (Update & Synchronize M:M tags)
    const updateItemRes = await request(server, 'PUT', `/api/v1/items/${createdItemId}`, {
      title: 'Satellite Uplink Encryption Key (Rotated)',
      sensitivityScore: 95,
      tagIds: [3, 4]
    });
    assert(updateItemRes.status === 200 && updateItemRes.body.data.tags.length === 2, 'PUT /api/v1/items/:id synchronizes M:M junction tags');

    // ------------------------------------------------------------------------
    console.log(`\n${bold}SECTION 4: The Shield - Database Constraints & Integrity (Pillar 4)${reset}`);
    // ------------------------------------------------------------------------

    // UNIQUE constraint test (duplicate email)
    const duplicateEmailRes = await request(server, 'POST', '/api/v1/users', {
      username: 'unique_user_2',
      email: 'admin@persistentvault.internal', // Duplicate
      password: 'Password123!',
      profile: { fullName: 'Duplicate Tester' }
    });
    assert(duplicateEmailRes.status === 409, 'UNIQUE Constraint: Duplicate email correctly triggers 409 Conflict');

    // UNIQUE constraint test (duplicate username)
    const duplicateUsernameRes = await request(server, 'POST', '/api/v1/users', {
      username: 'cyber_admin', // Duplicate
      email: 'cyber_admin_other@internal.test',
      password: 'Password123!',
      profile: { fullName: 'Duplicate Username' }
    });
    assert(duplicateUsernameRes.status === 409, 'UNIQUE Constraint: Duplicate username correctly triggers 409 Conflict');

    // UNIQUE constraint test (1:1 profile duplicate)
    try {
      db.prepare('INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)').run(1, 'Duplicate 1:1 Profile');
      assert(false, 'UNIQUE Constraint: Multiple profiles for same user must fail');
    } catch (err) {
      assert(err.message.includes('UNIQUE constraint failed'), 'UNIQUE Constraint on user_profiles.user_id enforces strict 1:1 exclusivity');
    }

    // CHECK constraint test (invalid user role)
    const invalidRoleRes = await request(server, 'POST', '/api/v1/users', {
      username: 'bad_role_user',
      email: 'bad_role@test.internal',
      password: 'Password123!',
      role: 'SUPER_HACKER_UNAUTHORIZED',
      profile: { fullName: 'Bad Role' }
    });
    assert(invalidRoleRes.status === 400 || invalidRoleRes.status === 422, 'CHECK Constraint / Validation: Invalid role rejected');

    // CHECK constraint test (sensitivity_score > 100)
    const invalidSensitivityRes = await request(server, 'POST', '/api/v1/items', {
      userId: 1,
      title: 'Over 9000 secret',
      secretType: 'LOGIN',
      payload: 'secret-val',
      sensitivityScore: 9000
    });
    assert(invalidSensitivityRes.status === 400 || invalidSensitivityRes.status === 422, 'CHECK Constraint / Validation: sensitivity_score > 100 rejected');

    // FOREIGN KEY constraint test (referencing non-existent user)
    const invalidFkRes = await request(server, 'POST', '/api/v1/items', {
      userId: 999999, // Non-existent user
      title: 'Ghost Secret',
      secretType: 'SECURE_NOTE',
      payload: 'ghost-data',
      sensitivityScore: 50
    });
    assert(invalidFkRes.status === 404 || invalidFkRes.status === 409, 'FOREIGN KEY Constraint: Non-existent parent user reference rejected');

    // ------------------------------------------------------------------------
    console.log(`\n${bold}SECTION 5: Threat Neutralization - Parameterized Queries vs SQL Injection${reset}`);
    // ------------------------------------------------------------------------

    // Attack Vector 1: Classic Authentication Bypass (' OR '1'='1)
    const sqliAuthPayload = "' OR '1'='1";
    const sqliRes1 = await request(server, 'POST', '/api/v1/security/injection-sandbox', { searchInput: sqliAuthPayload });
    assert(sqliRes1.status === 200, 'Injection Sandbox Endpoint reachable');
    assert(sqliRes1.body.data.safeExecution.rowsReturned === 0, `Payload "${sqliAuthPayload}" returned 0 records because parameterization treated it as harmless literal text`);

    // Attack Vector 2: Query termination & SQL Comment (admin' --)
    const sqliRes2 = await request(server, 'POST', '/api/v1/security/injection-sandbox', { searchInput: "admin' --" });
    assert(sqliRes2.body.data.safeExecution.rowsReturned === 0, `Payload "admin' --" treated solely as literal search string`);

    // Attack Vector 3: Destructive Stacked Query ('; DROP TABLE users; --)
    const sqliRes3 = await request(server, 'POST', '/api/v1/security/injection-sandbox', { searchInput: "'; DROP TABLE users; --" });
    assert(sqliRes3.body.data.safeExecution.rowsReturned === 0, `Payload "'; DROP TABLE users; --" failed to execute any stacked command`);

    // Attack Vector 4: Union-based extraction attack (' UNION SELECT 1,2,3,4,5,6,7,8 --)
    const sqliRes4 = await request(server, 'POST', '/api/v1/security/injection-sandbox', { searchInput: "' UNION SELECT 1,2,3,4,5,6,7,8 --" });
    assert(sqliRes4.body.data.safeExecution.rowsReturned === 0, 'UNION attack safely neutralized by prepared parameter bindings');

    // Verify users table is completely unharmed
    const usersCountAfterAttack = db.prepare('SELECT COUNT(*) as count FROM users').get();
    assert(usersCountAfterAttack.count >= 5, `Database Shield Intact: Users table retains all ${usersCountAfterAttack.count} records without corruption`);

    // ------------------------------------------------------------------------
    console.log(`\n${bold}SECTION 6: Relational Integrity & ON DELETE CASCADE / SET NULL${reset}`);
    // ------------------------------------------------------------------------

    // Delete the newly created user (agent_phoenix)
    const deleteUserRes = await request(server, 'DELETE', `/api/v1/users/${newUserId}`);
    assert(deleteUserRes.status === 200, `DELETE /api/v1/users/${newUserId} successfully executed`);

    // Verify profile was cascaded
    const profileAfterDelete = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(newUserId);
    assert(!profileAfterDelete, 'ON DELETE CASCADE: UserProfile was automatically deleted');

    // Verify folder was cascaded
    const folderAfterDelete = db.prepare('SELECT * FROM vault_folders WHERE user_id = ?').get(newUserId);
    assert(!folderAfterDelete, 'ON DELETE CASCADE: VaultFolder was automatically deleted');

    // Verify vault item was cascaded
    const itemAfterDelete = db.prepare('SELECT * FROM vault_items WHERE id = ?').get(createdItemId);
    assert(!itemAfterDelete, 'ON DELETE CASCADE: VaultItem was automatically deleted');

    // Verify junction table records were cascaded
    const junctionAfterDelete = db.prepare('SELECT * FROM vault_item_tags WHERE vault_item_id = ?').all(createdItemId);
    assert(junctionAfterDelete.length === 0, 'ON DELETE CASCADE: Junction rows in vault_item_tags automatically cleaned up');

    // Clean up created tag
    const deleteTagRes = await request(server, 'DELETE', `/api/v1/tags/${newTagId}`);
    assert(deleteTagRes.status === 200, 'DELETE /api/v1/tags/:id removes tag successfully');

    // ------------------------------------------------------------------------
    console.log(`\n${bold}SECTION 7: Domain Demonstrations (Academics & Commerce)${reset}`);
    // ------------------------------------------------------------------------

    // Academic M:M Enrollment Creation
    const createStudentRes = await request(server, 'POST', '/api/v1/academics/students', {
      studentCode: 'STU-2026-999',
      fullName: 'Elena Rostova',
      email: 'elena.r@university.edu',
      enrollmentYear: 2026,
      gpa: 3.98
    });
    assert(createStudentRes.status === 201, 'POST /api/v1/academics/students creates student');
    const newStudentId = createStudentRes.body.data.id;

    const enrollRes = await request(server, 'POST', '/api/v1/academics/enroll', {
      studentId: newStudentId,
      courseId: 1,
      grade: 'A'
    });
    assert(enrollRes.status === 201, 'POST /api/v1/academics/enroll enrolls student in course (M:M junction)');

    const academicRes = await request(server, 'GET', '/api/v1/academics/students');
    assert(academicRes.status === 200 && academicRes.body.data.length >= 5, 'GET /api/v1/academics/students returns all students with course arrays');

    // Commerce 1:Many Orders
    const createCustomerRes = await request(server, 'POST', '/api/v1/commerce/customers', {
      customerCode: 'CUST-2026-X',
      name: 'Prism Optics Laboratory',
      email: 'lab@prismoptics.com',
      loyaltyTier: 'PLATINUM'
    });
    assert(createCustomerRes.status === 201, 'POST /api/v1/commerce/customers creates customer');
    const newCustomerId = createCustomerRes.body.data.id;

    const createOrderRes = await request(server, 'POST', '/api/v1/commerce/orders', {
      orderNumber: 'ORD-2026-PRISM-1',
      customerId: newCustomerId,
      totalAmount: 7850.25,
      status: 'PROCESSING',
      shippingAddress: '101 Photonics Blvd, Silicon Valley, CA'
    });
    assert(createOrderRes.status === 201, 'POST /api/v1/commerce/orders creates order for customer');

    const customerDetailsRes = await request(server, 'GET', `/api/v1/commerce/customers/${newCustomerId}`);
    assert(customerDetailsRes.status === 200 && customerDetailsRes.body.data.totalOrders === 1, 'GET /api/v1/commerce/customers/:id returns customer with orders history (1:Many)');

    // PRAGMA foreign_key_check integrity
    const fkCheckRes = await request(server, 'GET', '/api/v1/system/integrity');
    assert(fkCheckRes.status === 200 && fkCheckRes.body.data.isShieldIntact === true, 'GET /api/v1/system/integrity verifies 0 foreign key violations');

  } finally {
    server.close();
    close();
  }

  console.log(`\n${bold}========================================================================${reset}`);
  console.log(`${bold}TEST SUMMARY: ${green}${passed} PASSED${reset}, ${failed > 0 ? `${red}${failed} FAILED` : `${green}0 FAILED`}${reset}`);
  console.log(`${bold}========================================================================${reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
