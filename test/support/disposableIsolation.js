import assert from "node:assert/strict";
import path from "node:path";
import { validateTestDatabaseConfig } from "../../utils/configValidation.js";

const normalize = value => {
  const resolved = path.resolve(value).replaceAll("\\", "/").replace(/\/$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

export async function assertDisposableIsolation(connection, env = process.env) {
  validateTestDatabaseConfig(env);
  assert.equal(env.FINTRACK_DISPOSABLE_MYSQL, "true", "Explicit disposable runner required");
  assert.ok(env.FINTRACK_TEST_DATADIR && env.FINTRACK_TEST_SERVER_UUID && env.FINTRACK_TEST_NONCE,
    "Missing private runner identity");
  const [[server]] = await connection.query(
    "SELECT @@datadir AS dataDir, @@port AS port, @@server_uuid AS uuid, DATABASE() AS db, CURRENT_USER() AS principal",
  );
  assert.equal(normalize(server.dataDir), normalize(env.FINTRACK_TEST_DATADIR));
  assert.equal(Number(server.port), Number(env.DB_PORT));
  assert.equal(server.uuid, env.FINTRACK_TEST_SERVER_UUID);
  assert.equal(server.db, env.DB_NAME);
  assert.equal(server.principal, `${env.DB_USER}@127.0.0.1`);
  const [[marker]] = await connection.query("SELECT nonce FROM _fintrack_test_isolation");
  assert.equal(marker.nonce, env.FINTRACK_TEST_NONCE);
  const [grants] = await connection.query("SHOW GRANTS FOR CURRENT_USER()");
  for (const row of grants) {
    const grant = Object.values(row)[0];
    assert.ok(!/WITH GRANT OPTION/.test(grant), "Delegated privileges are forbidden");
    assert.ok(grant.startsWith("GRANT USAGE ON *.*") ||
      (grant.includes(`ON \`${env.DB_NAME}\`.*`) && !/GRANT OPTION|ALL PRIVILEGES/.test(grant)),
    "Unexpected broad database privileges");
  }
}
