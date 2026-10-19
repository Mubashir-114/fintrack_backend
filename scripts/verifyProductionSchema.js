// Isolated disposable verification for FinTrack 2.0 Production Schema (fintrack_2.0_production_schema.sql)
// Target: Validates clean installation on an empty database (MySQL 8.4.11)
// Never connects to Aiven, Railway, or remote services.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import mysql from "mysql2/promise";
import assert from "node:assert/strict";
import { assertDisposableIsolation } from "../test/support/disposableIsolation.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const executable = process.env.FINTRACK_TEST_MYSQLD ||
  (process.platform === "win32" ? "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe" : "mysqld");
const runId = randomBytes(6).toString("hex");
const directory = await mkdtemp(path.join(tmpdir(), "fintrack-schema-verify-"));
const dataDir = path.join(directory, "data");
await mkdir(dataDir);
const nonce = randomBytes(32).toString("hex");
const dbName = `fintrack_test_${runId}`;
const appUser = dbName;
const appPassword = `fintrack-test-${randomBytes(32).toString("hex")}`;
const analyticsPassword = `fintrack-analytics-${randomBytes(32).toString("hex")}`;
const logFile = path.join(directory, "server.log");
let server, admin;
let stopped = false;
let identityConfirmed = false;
let spawnFailed = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, cwd: root, ...options });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Command failed (exit ${code})`)));
  });
}

try {
  console.log("1. Initializing isolated disposable MySQL 8.4 instance...");
  await run(executable, ["--no-defaults", "--initialize-insecure", `--datadir=${dataDir}`, `--log-error=${logFile}`], { stdio: "ignore" });
  const uuid = (await readFile(path.join(dataDir, "auto.cnf"), "utf8")).match(/server-uuid=([^\r\n]+)/)?.[1];
  assert.ok(uuid, "Fresh server identity missing");

  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));

  server = spawn(executable, [
    "--no-defaults", `--datadir=${dataDir}`, "--bind-address=127.0.0.1",
    `--port=${port}`, "--mysqlx=OFF", "--skip-log-bin", "--performance-schema=OFF",
    "--innodb-buffer-pool-size=32M", "--max-connections=16", `--log-error=${logFile}`,
  ], { cwd: directory, windowsHide: true, stdio: "ignore" });

  server.on("error", () => { spawnFailed = true; });
  const deadline = Date.now() + 30000;
  while (!admin && !spawnFailed && Date.now() < deadline && server.exitCode === null) {
    try {
      admin = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", password: "", connectTimeout: 1000 });
    } catch {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  assert.ok(admin, "Disposable server did not become ready; installed service was not used");

  const [[identity]] = await admin.query("SELECT @@datadir AS dataDir, @@server_uuid AS uuid, @@port AS port, @@version AS version");
  assert.equal(path.resolve(identity.dataDir).toLowerCase(), path.resolve(dataDir).toLowerCase());
  assert.equal(identity.uuid, uuid);
  assert.equal(Number(identity.port), port);
  identityConfirmed = true;
  console.log(`✓ Process identity verified: MySQL ${identity.version} on 127.0.0.1:${port}`);

  console.log(`2. Creating empty database '${dbName}'...`);
  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);

  console.log("3. Installing fintrack_2.0_production_schema.sql (with foreign_key_checks=1)...");
  const schemaSql = await readFile(path.join(root, "migrations", "fintrack_2.0_production_schema.sql"), "utf8");
  const bootstrap = await mysql.createConnection({
    host: "127.0.0.1", port, user: "root", database: dbName, multipleStatements: true,
  });

  try {
    // Strictly verify FOREIGN_KEY_CHECKS is active during execution
    const [[fkCheck]] = await bootstrap.query("SELECT @@foreign_key_checks AS fk");
    assert.equal(Number(fkCheck.fk), 1, "Foreign key checks must be enabled");

    await bootstrap.query(schemaSql);

    // Marker for test isolation
    await bootstrap.query("CREATE TABLE _fintrack_test_isolation (nonce CHAR(64) NOT NULL) ENGINE=InnoDB");
    await bootstrap.execute("INSERT INTO _fintrack_test_isolation VALUES (?)", [nonce]);
  } finally {
    await bootstrap.end();
  }
  console.log("✓ Schema installed cleanly with foreign_key_checks active.");

  console.log("4. Validating schema objects, counts, and invariants...");
  const conn = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", database: dbName });
  try {
    // A. Expected Table Count (12 application tables + 1 test marker)
    const [tables] = await conn.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name <> '_fintrack_test_isolation' ORDER BY table_name",
      [dbName],
    );
    const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);
    const expectedTables = [
      "account_adjustments",
      "accounts",
      "budgets",
      "categories",
      "detected_transactions",
      "goal_contributions",
      "savings_goals",
      "schema_migrations",
      "transactions",
      "transfers",
      "user_companion_preferences",
      "users",
    ];
    assert.deepEqual(tableNames.sort(), expectedTables.sort(), `Expected 12 tables: ${expectedTables.join(", ")}`);
    console.log(`✓ Table count verified: 12 tables (${tableNames.join(", ")})`);

    // B. Default Categories Count
    const [[catCount]] = await conn.query("SELECT COUNT(*) AS total FROM categories");
    assert.equal(Number(catCount.total), 12, "Expected 12 default categories");
    console.log("✓ 12 default categories verified.");

    // C. Migrations Tracker Count
    const [[migCount]] = await conn.query("SELECT COUNT(*) AS total FROM schema_migrations");
    assert.equal(Number(migCount.total), 7, "Expected 7 recorded migration baseline records (0001-0007)");
    console.log("✓ 7 baseline migration records registered.");

    // D. SMS Duplicate Scope Verification
    const [smsIndexes] = await conn.query(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'uq_transaction_sms_hash'
        ORDER BY SEQ_IN_INDEX`,
      [dbName],
    );
    assert.equal(smsIndexes.length, 2, "uq_transaction_sms_hash must be composite (user_id, sms_hash)");
    assert.equal(smsIndexes[0].COLUMN_NAME, "user_id");
    assert.equal(smsIndexes[1].COLUMN_NAME, "sms_hash");
    assert.equal(smsIndexes[0].NON_UNIQUE, 0, "Index must be UNIQUE");
    console.log("✓ SMS hash uniqueness correctly scoped to (user_id, sms_hash).");

    // E. Test Cross-User vs Same-User SMS Hash Behavior
    await conn.query("INSERT INTO users (id, name, email, password) VALUES (1, 'User One', 'u1@test.local', 'hash1'), (2, 'User Two', 'u2@test.local', 'hash2')");
    // Cross-user insert of the same hash must SUCCEED
    await conn.query("INSERT INTO transactions (user_id, category_id, type, title, amount, transaction_date, sms_hash) VALUES (1, 3, 'expense', 'Coffee', 150.00, '2026-10-19', 'HASH_XYZ_123')");
    await conn.query("INSERT INTO transactions (user_id, category_id, type, title, amount, transaction_date, sms_hash) VALUES (2, 3, 'expense', 'Coffee', 150.00, '2026-10-19', 'HASH_XYZ_123')");
    console.log("✓ Cross-user identical SMS hash successfully allowed for distinct users.");

    // Same-user duplicate insert of the same hash must FAIL
    let duplicateRejected = false;
    try {
      await conn.query("INSERT INTO transactions (user_id, category_id, type, title, amount, transaction_date, sms_hash) VALUES (1, 3, 'expense', 'Duplicate Coffee', 150.00, '2026-10-19', 'HASH_XYZ_123')");
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") duplicateRejected = true;
    }
    assert.ok(duplicateRejected, "Same-user duplicate SMS hash must be rejected with ER_DUP_ENTRY");
    console.log("✓ Same-user duplicate SMS hash rejected as expected.");

    // Clean up temporary test rows
    await conn.query("DELETE FROM transactions");
    await conn.query("DELETE FROM users");

    // F. Verify Account Stored Generated Column & Constraints
    const [accountColumns] = await conn.query(
      `SELECT COLUMN_NAME, EXTRA
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'active_default_asset_user_id'`,
      [dbName],
    );
    assert.ok(accountColumns[0]?.EXTRA.includes("STORED GENERATED"), "active_default_asset_user_id must be STORED GENERATED");
    console.log("✓ Account active_default_asset_user_id STORED GENERATED column verified.");

    // G. Verify Foreign Key Constraints on All Child Tables
    const [foreignKeys] = await conn.query(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME, DELETE_RULE
         FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = ?`,
      [dbName],
    );
    assert.equal(foreignKeys.length, 20, "Expected exactly 20 foreign key constraints across the schema");
    const fkMap = new Map(foreignKeys.map(fk => [`${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME}`, fk]));
    assert.equal(fkMap.get("accounts.fk_accounts_user")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("transactions.fk_transactions_user")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("transactions.fk_transactions_category")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("transactions.fk_transactions_account")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("budgets.fk_budgets_user")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("budgets.fk_budgets_category")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("transfers.fk_transfers_user")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("transfers.fk_transfers_source_account")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("transfers.fk_transfers_dest_account")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("account_adjustments.fk_adjustments_user")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("account_adjustments.fk_adjustments_account")?.DELETE_RULE, "RESTRICT");
    assert.equal(fkMap.get("detected_transactions.fk_detected_user")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("detected_transactions.fk_detected_account")?.DELETE_RULE, "SET NULL");
    assert.equal(fkMap.get("detected_transactions.fk_detected_category")?.DELETE_RULE, "SET NULL");
    assert.equal(fkMap.get("detected_transactions.fk_detected_confirmed_tx")?.DELETE_RULE, "SET NULL");
    assert.equal(fkMap.get("savings_goals.fk_goals_user")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("goal_contributions.fk_contributions_goal")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("goal_contributions.fk_contributions_user")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("user_companion_preferences.fk_companion_user")?.DELETE_RULE, "CASCADE");
    assert.equal(fkMap.get("user_companion_preferences.fk_companion_priority_goal")?.DELETE_RULE, "SET NULL");
    console.log("✓ All 20 foreign key constraints and DELETE rules verified.");
    // Apply only to this identity-verified disposable database, never production.
    const avatarMigration = await readFile(path.join(root, 'migrations', '20261019_01_user_avatars.sql'), 'utf8');
    await conn.query(avatarMigration);
    await conn.query(avatarMigration); // The additive migration is repeatable.
    await conn.execute("INSERT INTO users (id, name, email, password) VALUES (3, 'Avatar Test', 'avatar@example.test', 'synthetic-hash')");
    await conn.execute('INSERT INTO user_avatars (user_id, jpeg) VALUES (?, ?)', [3, Buffer.from('synthetic-jpeg')]);
    await assert.rejects(conn.execute('INSERT INTO user_avatars (user_id, jpeg) VALUES (?, ?)', [99, Buffer.from('synthetic-jpeg')]), { code: 'ER_NO_REFERENCED_ROW_2' });
    await conn.execute('DELETE FROM users WHERE id = ?', [3]);
    const [[avatarCount]] = await conn.query('SELECT COUNT(*) AS total FROM user_avatars');
    assert.equal(Number(avatarCount.total), 0, 'Deleting an owner must cascade to their avatar');
    console.log('Avatar migration verified: repeatable DDL, owner FK and cascading deletion.');
  } finally {
    await conn.end();
  }

  console.log("5. Provisioning least-privilege application and analytics test users...");
  await admin.query("CREATE USER ?@'127.0.0.1' IDENTIFIED BY ?", [appUser, appPassword]);
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO ?@'127.0.0.1'`, [appUser]);

  const analyticsUser = `f_analytics_${runId}`;
  await admin.query("CREATE USER ?@'127.0.0.1' IDENTIFIED BY ?", [analyticsUser, analyticsPassword]);
  await admin.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query(`GRANT SELECT ON \`${dbName}\`.transactions TO ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query(`GRANT SELECT ON \`${dbName}\`.categories TO ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query(`GRANT SELECT ON \`${dbName}\`.budgets TO ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query(`GRANT SELECT ON \`${dbName}\`.accounts TO ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query(`GRANT SELECT ON \`${dbName}\`.savings_goals TO ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query(`GRANT SELECT ON \`${dbName}\`.goal_contributions TO ?@'127.0.0.1'`, [analyticsUser]);
  await admin.query("FLUSH PRIVILEGES");
  console.log("✓ Application and analytics roles provisioned.");

  console.log("6. Verifying read-only analytics least-privilege boundary...");
  const analyticsConn = await mysql.createConnection({
    host: "127.0.0.1", port, user: analyticsUser, password: analyticsPassword, database: dbName,
  });
  try {
    // SELECT on transactions must succeed
    const [txRows] = await analyticsConn.query("SELECT COUNT(*) AS total FROM transactions");
    assert.equal(Number(txRows[0].total), 0);

    // SELECT on detected_transactions must FAIL with access denied
    let detectedBlocked = false;
    try {
      await analyticsConn.query("SELECT * FROM detected_transactions LIMIT 1");
    } catch (err) {
      if (err.code === "ER_TABLEACCESS_DENIED_ERROR") detectedBlocked = true;
    }
    assert.ok(detectedBlocked, "Analytics user must be denied access to detected_transactions");

    // SELECT on users must FAIL with access denied
    let usersBlocked = false;
    try {
      await analyticsConn.query("SELECT * FROM users LIMIT 1");
    } catch (err) {
      if (err.code === "ER_TABLEACCESS_DENIED_ERROR") usersBlocked = true;
    }
    assert.ok(usersBlocked, "Analytics user must be denied access to users");

    // Mutation on transactions must FAIL
    let mutationBlocked = false;
    try {
      await analyticsConn.query("INSERT INTO transactions (user_id, category_id, type, title, amount, transaction_date) VALUES (1, 1, 'income', 'X', 1, '2026-10-19')");
    } catch (err) {
      if (err.code === "ER_TABLEACCESS_DENIED_ERROR") mutationBlocked = true;
    }
    assert.ok(mutationBlocked, "Analytics user must be denied INSERT permissions");
    console.log("✓ Analytics least-privilege boundaries confirmed: SELECT-only on approved tables, users/detected_transactions blocked.");
  } finally {
    await analyticsConn.end();
  }

  console.log("7. Running integration security & deletion tests against the production schema...");
  const testEnv = {
    ...process.env,
    NODE_ENV: "test",
    FINTRACK_DISPOSABLE_MYSQL: "true",
    FINTRACK_TEST_RUN_ID: runId,
    DB_HOST: "127.0.0.1",
    DB_PORT: String(port),
    DB_NAME: dbName,
    DB_USER: appUser,
    DB_PASSWORD: appPassword,
    DB_SSL: "false",
    FINTRACK_TEST_DATADIR: dataDir,
    FINTRACK_TEST_SERVER_UUID: uuid,
    FINTRACK_TEST_NONCE: nonce,
  };

  await run(process.execPath, [
    "--import", "./config/testEnv.js",
    "--test", "test/accountSecurity.integration.test.js",
  ], { env: testEnv, stdio: "inherit" });
  console.log("✓ Integration and account deletion tests passed against production schema.");

  console.log("\n=======================================================");
  console.log("SUCCESS: FinTrack 2.0 Production Schema Validation PASSED");
  console.log("=======================================================\n");

} catch (error) {
  console.error(`\nFAILED: Schema verification failed: ${error.message}\n`, error);
  process.exitCode = 1;
} finally {
  if (admin) {
    try {
      const [[identity]] = await admin.query("SELECT @@datadir AS dataDir");
      if (identityConfirmed && path.resolve(identity.dataDir).toLowerCase() === path.resolve(dataDir).toLowerCase()) {
        await admin.query("SHUTDOWN");
      }
    } catch {}
    await admin.end().catch(() => {});
  }
  if (server && !spawnFailed) {
    if (server.exitCode === null) {
      await Promise.race([
        new Promise(resolve => server.once("exit", resolve)),
        new Promise(resolve => setTimeout(resolve, 10000).unref()),
      ]);
    }
    if (server.exitCode === null) {
      server.kill();
      await new Promise(resolve => server.once("exit", resolve));
    }
    stopped = true;
  } else {
    stopped = true;
  }
  if (stopped) {
    assert.ok(path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith("fintrack-schema-verify-"));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log("Disposable MySQL stopped and ephemeral directory cleanly removed.");
  }
}
