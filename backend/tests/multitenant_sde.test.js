const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-testing';
process.env.DB_PATH = path.join(__dirname, '../../test_data.db');

if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

const db = require('../src/db/database');
const { encryptCell, decryptCell } = require('../src/utils/crypto');
const { logAuditEvent, verifyAuditChain } = require('../src/utils/auditLogger');
const { computeWorkspaceMetrics } = require('../src/services/metricsEngine');

async function runTests() {
  console.log('🧪 Starting Ledgerly Multi-Tenant SDE Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Setup Users & Workspaces
  const aliceId = db.prepare("INSERT INTO users (email, name) VALUES ('alice@wsA.com', 'Alice')").run().lastInsertRowid;
  const bobId = db.prepare("INSERT INTO users (email, name) VALUES ('bob@wsA.com', 'Bob')").run().lastInsertRowid;
  const daveId = db.prepare("INSERT INTO users (email, name) VALUES ('dave@wsB.com', 'Dave')").run().lastInsertRowid;

  const wsA = 'ws_tenant_A';
  const wsB = 'ws_tenant_B';

  db.prepare("INSERT INTO workspaces (id, name, owner_id) VALUES (?, 'Workspace A', ?)").run(wsA, aliceId);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, email, role) VALUES (?, ?, 'alice@wsA.com', 'OWNER')").run(wsA, aliceId);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, email, role) VALUES (?, ?, 'bob@wsA.com', 'EDITOR')").run(wsA, bobId);

  db.prepare("INSERT INTO workspaces (id, name, owner_id) VALUES (?, 'Workspace B', ?)").run(wsB, daveId);
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, email, role) VALUES (?, ?, 'dave@wsB.com', 'OWNER')").run(wsB, daveId);

  // Test 1: Cell Encryption & Decryption
  test('Cryptographic AES-256-GCM Cell Encryption & Decryption', () => {
    const original = '150000.50';
    const encrypted = encryptCell(original);
    assert.notStrictEqual(encrypted.encryptedText, original);
    const decrypted = decryptCell(encrypted.encryptedText, encrypted.iv, encrypted.authTag);
    assert.strictEqual(decrypted, original);
  });

  // Test 2: Tamper Rejection
  test('Cryptographic Tamper Detection Rejection', () => {
    const encrypted = encryptCell('50000');
    const result = decryptCell(encrypted.encryptedText, '000000000000000000000000', encrypted.authTag);
    assert.strictEqual(result, null);
  });

  // Test 3: Cross-Tenant Isolation
  test('Cross-Tenant Workspace Data Isolation', () => {
    const enc = encryptCell('100000');
    db.prepare(`
      INSERT INTO financial_records (workspace_id, period, category, encrypted_amount, iv, auth_tag)
      VALUES (?, '2026-05', 'Sales & Revenue', ?, ?, ?)
    `).run(wsA, enc.encryptedText, enc.iv, enc.authTag);

    const wsBRecords = db.prepare('SELECT * FROM financial_records WHERE workspace_id = ?').all(wsB);
    assert.strictEqual(wsBRecords.length, 0);

    const wsARecords = db.prepare('SELECT * FROM financial_records WHERE workspace_id = ?').all(wsA);
    assert.strictEqual(wsARecords.length, 1);
  });

  // Test 4: Transaction Rollback
  test('Transactional Rollback on Staged Import Failure', () => {
    const importId = 'imp_test_rollback';
    db.prepare("INSERT INTO imports (id, workspace_id, status) VALUES (?, ?, 'VALIDATING')").run(importId, wsA);

    try {
      db.transaction(() => {
        db.prepare("INSERT INTO financial_records (workspace_id, period, category, encrypted_amount, iv, auth_tag) VALUES (?, '2026-05', 'Rent', 'xyz', 'iv', 'tag')").run(wsA);
        throw new Error('Forced simulation of error');
      })();
    } catch (e) {}

    const checkRecords = db.prepare("SELECT * FROM financial_records WHERE category = 'Rent'").all();
    assert.strictEqual(checkRecords.length, 0);
  });

  // Test 5: Deterministic Financial Metrics Engine
  test('Deterministic Financial Metrics Calculation', () => {
    // Clear financial records for clean math check
    db.prepare('DELETE FROM financial_records WHERE workspace_id = ?').run(wsA);

    const revenueEnc = encryptCell('200000');
    const expenseEnc = encryptCell('80000');

    db.prepare(`
      INSERT INTO financial_records (workspace_id, period, category, encrypted_amount, iv, auth_tag)
      VALUES (?, '2026-05', 'Sales & Revenue', ?, ?, ?)
    `).run(wsA, revenueEnc.encryptedText, revenueEnc.iv, revenueEnc.authTag);

    db.prepare(`
      INSERT INTO financial_records (workspace_id, period, category, encrypted_amount, iv, auth_tag)
      VALUES (?, '2026-05', 'Salary / Wages', ?, ?, ?)
    `).run(wsA, expenseEnc.encryptedText, expenseEnc.iv, expenseEnc.authTag);

    const metrics = computeWorkspaceMetrics(wsA, '2026-05');
    assert.strictEqual(metrics.metrics.revenue.value, 200000);
    assert.strictEqual(metrics.metrics.expenses.value, 80000);
    assert.strictEqual(metrics.metrics.netProfit.value, 120000);
    assert.strictEqual(metrics.dataQuality, 'VALID');
  });

  // Test 6: SHA-256 Hash Chained Audit Log Integrity
  test('Tamper-Evident SHA-256 Audit Log Hash Chain Verification', () => {
    logAuditEvent({ workspaceId: wsA, actorUserId: aliceId, eventType: 'WORKSPACE_CREATED', resourceType: 'WORKSPACE', resourceId: wsA });
    logAuditEvent({ workspaceId: wsA, actorUserId: aliceId, eventType: 'ROLE_CHANGED', resourceType: 'USER', resourceId: bobId });

    const integrity = verifyAuditChain(wsA);
    if (!integrity.valid) console.log('Audit Integrity Debug:', integrity);
    assert.strictEqual(integrity.valid, true);
    assert.strictEqual(integrity.count >= 2, true);
  });

  console.log(`\n📊 Test Suite Summary: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) process.exit(1);

  if (fs.existsSync(process.env.DB_PATH)) {
    fs.unlinkSync(process.env.DB_PATH);
  }
}

runTests().catch(err => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
