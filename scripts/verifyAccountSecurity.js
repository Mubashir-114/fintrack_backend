// Owns an ephemeral MySQL process. Never connects to the installed MySQL service,
// loads .env, reads production credentials, or reuses an existing data directory.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
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
const directory = await mkdtemp(path.join(tmpdir(), "fintrack-isolated-mysql-"));
const dataDir = path.join(directory, "data");
await mkdir(dataDir);
const nonce = randomBytes(32).toString("hex");
const password = `fintrack-test-${randomBytes(32).toString("hex")}`;
const dbName = `fintrack_test_${runId}`;
const logFile = path.join(directory, "server.log");
let server, admin;
let stopped = false;
let identityConfirmed = false;
let spawnFailed = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, cwd: root, ...options });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Disposable command failed (exit ${code})`)));
  });
}

try {
  await run(executable, ["--no-defaults", "--initialize-insecure", `--datadir=${dataDir}`, `--log-error=${logFile}`], { stdio: "ignore" });
  const uuid = (await readFile(path.join(dataDir, "auto.cnf"), "utf8")).match(/server-uuid=([^\r\n]+)/)?.[1];
  assert.ok(uuid, "Fresh server identity missing");
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  server = spawn(executable, ["--no-defaults", `--datadir=${dataDir}`, "--bind-address=127.0.0.1",
    `--port=${port}`, "--mysqlx=OFF", "--skip-log-bin", "--performance-schema=OFF",
    "--innodb-buffer-pool-size=32M", "--max-connections=12", `--log-error=${logFile}`],
    { cwd: directory, windowsHide: true, stdio: "ignore" });
  server.on("error", () => { spawnFailed = true; });
  const deadline = Date.now() + 30000;
  while (!admin && !spawnFailed && Date.now() < deadline && server.exitCode === null) {
    try { admin = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", password: "", connectTimeout: 1000 }); }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  assert.ok(admin, "Disposable server did not become ready; installed service was not used");
  // This read-only proof must precede the FIRST database mutation.
  const [[identity]] = await admin.query("SELECT @@datadir AS dataDir, @@server_uuid AS uuid, @@port AS port");
  assert.equal(path.resolve(identity.dataDir).toLowerCase(), path.resolve(dataDir).toLowerCase());
  assert.equal(identity.uuid, uuid);
  assert.equal(Number(identity.port), port);
  identityConfirmed = true;
  console.log("Fresh MySQL process identity confirmed; isolated data directory and loopback port verified.");
  await admin.query(`CREATE DATABASE \`${dbName}\``);
  // A second connection permits reviewed multi-statement migration files ONLY
  // against this verified, freshly created database.
  const bootstrap = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", database: dbName, multipleStatements: true });
  try {
    const files = (await readdir(path.join(root, "migrations"))).filter(name => /^000[1-7]_.*\.sql$/.test(name)).sort();
    assert.equal(files.length, 7);
    for (const file of files) await bootstrap.query(await readFile(path.join(root, "migrations", file), "utf8"));
    await bootstrap.query("CREATE TABLE _fintrack_test_isolation (nonce CHAR(64) NOT NULL) ENGINE=InnoDB");
    await bootstrap.execute("INSERT INTO _fintrack_test_isolation VALUES (?)", [nonce]);
  } finally { await bootstrap.end(); }
  await admin.query("CREATE USER ?@'127.0.0.1' IDENTIFIED BY ?", [dbName, password]);
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO ?@'127.0.0.1'`, [dbName]);
  const env = { ...process.env, NODE_ENV: "test", FINTRACK_DISPOSABLE_MYSQL: "true", FINTRACK_TEST_RUN_ID: runId,
    DB_HOST: "127.0.0.1", DB_PORT: String(port), DB_NAME: dbName, DB_USER: dbName, DB_PASSWORD: password,
    DB_SSL: "false", FINTRACK_TEST_DATADIR: dataDir, FINTRACK_TEST_SERVER_UUID: uuid, FINTRACK_TEST_NONCE: nonce };
  const restricted = await mysql.createConnection({ host: env.DB_HOST, port, user: dbName, password, database: dbName });
  try { await assertDisposableIsolation(restricted, env); } finally { await restricted.end(); }
  console.log("Synthetic database marker and least-privilege test identity verified; running real API/deletion tests.");
  const tests = process.argv.includes("--all") ? [] : ["test/accountSecurity.integration.test.js"];
  await run(process.execPath, ["--import", "./config/testEnv.js", "--test", ...tests], { env, stdio: "inherit" });
} catch (error) {
  console.error(`Isolated verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (admin) {
    // Only the already identity-verified connection is allowed to shut down.
    try {
      const [[identity]] = await admin.query("SELECT @@datadir AS dataDir");
      if (identityConfirmed && path.resolve(identity.dataDir).toLowerCase() === path.resolve(dataDir).toLowerCase()) await admin.query("SHUTDOWN");
    } catch { /* SHUTDOWN can close the connection before replying. */ }
    await admin.end().catch(() => {});
  }
  if (server && !spawnFailed) {
    if (server.exitCode === null) {
      await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 10000).unref())]);
    }
    if (server.exitCode === null) {
      server.kill(); // Only the child process created above, never a service/PID lookup.
      await new Promise(resolve => server.once("exit", resolve));
    }
    stopped = true;
  } else { stopped = true; }
  if (stopped) {
    // Exact mkdtemp-owned directory only; never a caller-provided path.
    assert.ok(path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith("fintrack-isolated-mysql-"));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log("Disposable MySQL stopped and its generated data directory removed.");
  }
}
