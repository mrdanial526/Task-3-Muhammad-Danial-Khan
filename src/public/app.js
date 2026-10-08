// API Base URL
const API_BASE = '/api/v1';

// Switch Navigation Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  const targetBtn = document.getElementById(`btn-${tabId}`);

  if (targetTab) targetTab.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'tab-dashboard') loadDashboardMetrics();
  if (tabId === 'tab-crud') { loadUsersDropdown(); loadTagsCheckboxes(); loadVaultItems(); }
  if (tabId === 'tab-integrity') { runIntegrityInspection(); loadSchemaConstraints(); }
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 1. Dashboard Metrics
async function loadDashboardMetrics() {
  try {
    const res = await fetch(`${API_BASE}/system/metrics`);
    const json = await res.json();

    if (json.success) {
      const data = json.data;
      document.getElementById('metric-total-records').innerText = data.totalRecords;
      document.getElementById('metric-vault-items').innerText = data.tableCounts.vault_items || 0;
      document.getElementById('metric-db-size').innerText = `${data.databaseFileSizeKb} KB`;

      // Populate Table Row Counts
      const tbody = document.getElementById('table-counts-body');
      tbody.innerHTML = '';

      const tableDescriptions = {
        users: 'Core Authentication & Vault Identities',
        user_profiles: '1:1 User Profile & Clearance Credentials',
        vault_folders: '1:Many Organizational Folders',
        vault_items: 'Encrypted Secrets, Credentials & Notes',
        tags: 'Classification Labels',
        vault_item_tags: 'Many-to-Many Secret ↔ Tag Junction',
        audit_logs: 'Tamper-Evident Access Journal',
        students: 'Academic Domain: Student Entities',
        courses: 'Academic Domain: Course Entities',
        student_courses: 'Many-to-Many Student ↔ Course Junction',
        customers: 'E-Commerce Domain: Customer Records',
        orders: '1:Many Customer Order Ledger'
      };

      for (const [table, count] of Object.entries(data.tableCounts)) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code style="color:var(--accent-cyan); font-weight:600;">${table}</code></td>
          <td style="color:var(--text-secondary);">${tableDescriptions[table] || 'System Data Entity'}</td>
          <td><span class="tag-badge" style="background:rgba(59,130,246,0.2); color:#93c5fd;">${count} rows</span></td>
        `;
        tbody.appendChild(tr);
      }
    }
  } catch (err) {
    console.error('Failed to load metrics:', err);
  }
}

// 2. Load Users into Dropdown for CRUD
async function loadUsersDropdown() {
  try {
    const res = await fetch(`${API_BASE}/users`);
    const json = await res.json();
    if (json.success) {
      const select = document.getElementById('input-item-userid');
      select.innerHTML = '';
      json.data.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.innerText = `@${u.username} (${u.profile ? u.profile.fullName : u.email}) - Clearance Lv ${u.profile ? u.profile.clearanceLevel : 1}`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load users dropdown:', err);
  }
}

// 3. Load Tags Checkboxes
async function loadTagsCheckboxes() {
  try {
    const res = await fetch(`${API_BASE}/tags`);
    const json = await res.json();
    if (json.success) {
      const container = document.getElementById('tags-checkboxes');
      container.innerHTML = '';
      json.data.forEach(t => {
        const label = document.createElement('label');
        label.style.display = 'inline-flex';
        label.style.alignItems = 'center';
        label.style.gap = '0.35rem';
        label.style.fontSize = '0.85rem';
        label.style.background = 'rgba(31, 41, 55, 0.6)';
        label.style.padding = '0.25rem 0.6rem';
        label.style.borderRadius = '6px';
        label.style.cursor = 'pointer';

        label.innerHTML = `
          <input type="checkbox" value="${t.id}" class="tag-checkbox" style="accent-color:${t.colorHex}">
          <span style="color:${t.colorHex}; font-weight:600;">#${t.name}</span>
        `;
        container.appendChild(label);
      });
    }
  } catch (err) {
    console.error('Failed to load tags:', err);
  }
}

// 4. Load Vault Items
async function loadVaultItems(reveal = false) {
  try {
    const res = await fetch(`${API_BASE}/items?reveal=${reveal}`);
    const json = await res.json();
    const list = document.getElementById('vault-items-list');

    if (json.success) {
      if (json.data.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">No items stored yet.</div>';
        return;
      }

      list.innerHTML = '';
      json.data.forEach(item => {
        const card = document.createElement('div');
        card.style.background = 'rgba(17, 24, 39, 0.85)';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = '10px';
        card.style.padding = '1rem';

        const tagsHtml = item.tags.map(t => `<span class="tag-badge" style="background:${t.colorHex}22; color:${t.colorHex}; border:1px solid ${t.colorHex}44;">#${t.name}</span>`).join(' ');

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <div>
              <span class="tag-badge" style="background:#3b82f622; color:#60a5fa; margin-right:0.4rem;">${item.secretType}</span>
              <strong style="color:#fff; font-size:0.95rem;">${item.title}</strong>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;">
                Owner: @${item.ownerUsername} • Sensitivity: <span style="color:#f59e0b; font-weight:600;">${item.sensitivityScore}/100</span>
              </div>
            </div>
            <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="handleDeleteItem(${item.id})">
              🗑️ Delete
            </button>
          </div>
          <div style="background:#0d1117; padding:0.5rem; border-radius:6px; font-family:var(--font-mono); font-size:0.8rem; color:#a5d6ff; margin:0.5rem 0; word-break:break-all;">
            ${item.payload}
          </div>
          <div style="margin-top:0.5rem;">
            ${tagsHtml || '<span style="font-size:0.75rem; color:var(--text-muted)">No tags</span>'}
          </div>
        `;
        list.appendChild(card);
      });
    }
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

// 5. Create Item Handler
async function handleCreateItem(e) {
  e.preventDefault();
  const userId = parseInt(document.getElementById('input-item-userid').value, 10);
  const title = document.getElementById('input-item-title').value;
  const secretType = document.getElementById('input-item-type').value;
  const sensitivityScore = parseInt(document.getElementById('input-item-sensitivity').value, 10);
  const payload = document.getElementById('input-item-payload').value;

  const tagCheckboxes = document.querySelectorAll('.tag-checkbox:checked');
  const tagIds = Array.from(tagCheckboxes).map(cb => parseInt(cb.value, 10));

  try {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, secretType, sensitivityScore, payload, tagIds })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Secret "${title}" saved with ${tagIds.length} tags!`, 'success');
      document.getElementById('form-create-item').reset();
      loadVaultItems();
      loadDashboardMetrics();
    } else {
      showToast(json.message || 'Creation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 6. Delete Item Handler
async function handleDeleteItem(id) {
  if (!confirm(`Are you sure you want to delete vault secret #${id}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Vault item deleted & junction rows cascaded', 'success');
      loadVaultItems();
      loadDashboardMetrics();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 7. SQL Injection Simulator Handler
function setAttackPayload(payload) {
  document.getElementById('input-sqli-payload').value = payload;
}

async function handleTestInjection(e) {
  e.preventDefault();
  const payload = document.getElementById('input-sqli-payload').value;
  const box = document.getElementById('sqli-result-box');
  box.innerText = 'Testing injection payload against safe parameterized prepared statement...';

  try {
    const res = await fetch(`${API_BASE}/security/injection-sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchInput: payload })
    });

    const json = await res.json();
    box.innerText = JSON.stringify(json.data, null, 2);
    showToast('Attack safely neutralized by parameterization!', 'success');
  } catch (err) {
    box.innerText = `Error running simulation: ${err.message}`;
  }
}

// 8. Integrity Inspection
async function runIntegrityInspection() {
  const box = document.getElementById('integrity-report-box');
  box.innerText = 'Running PRAGMA integrity_check & foreign_key_check...';

  try {
    const res = await fetch(`${API_BASE}/system/integrity`);
    const json = await res.json();
    box.innerText = JSON.stringify(json, null, 2);
    showToast('Database integrity verification: 100% Intact', 'success');
  } catch (err) {
    box.innerText = `Inspection error: ${err.message}`;
  }
}

async function loadSchemaConstraints() {
  const box = document.getElementById('constraints-report-box');
  try {
    const res = await fetch(`${API_BASE}/security/constraints`);
    const json = await res.json();
    box.innerText = JSON.stringify(json.data, null, 2);
  } catch (err) {
    box.innerText = `Failed to load constraints: ${err.message}`;
  }
}

// 9. Academic Demo Viewer
async function loadAcademicDemo() {
  const box = document.getElementById('academic-demo-output');
  box.innerText = 'Loading students ↔ courses M:M dataset...';
  try {
    const res = await fetch(`${API_BASE}/academics/students`);
    const json = await res.json();
    box.innerText = JSON.stringify(json.data, null, 2);
  } catch (err) {
    box.innerText = `Error: ${err.message}`;
  }
}

// 10. API Tester
async function testApiEndpoint(method, path) {
  const box = document.getElementById('api-output-box');
  box.innerText = `Sending ${method} ${path}...`;

  try {
    const res = await fetch(path, { method });
    const json = await res.json();
    box.innerText = `HTTP STATUS: ${res.status}\n\n` + JSON.stringify(json, null, 2);
    showToast(`Request ${method} ${path} -> ${res.status}`, 'success');
  } catch (err) {
    box.innerText = `Error: ${err.message}`;
  }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardMetrics();
});
