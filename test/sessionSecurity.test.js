import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";
import { matchesSessionBinding } from "../utils/sessionBinding.js";
import { assertDisposableIsolation } from "./support/disposableIsolation.js";

test("session bindings change with credentials/owner and never expose the credential", () => {
  const hash = "synthetic-hash-one";
  const token = generateToken(7, hash);
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  assert.equal(matchesSessionBinding(decoded.session, 7, hash), true);
  assert.equal(matchesSessionBinding(decoded.session, 7, "synthetic-hash-two"), false);
  assert.equal(matchesSessionBinding(decoded.session, 8, hash), false);
  for (const invalid of [null, "", "00", "z".repeat(64), {}]) {
    assert.equal(matchesSessionBinding(invalid, 7, hash), false);
  }
  assert.equal(JSON.stringify(decoded).includes(hash), false);
  assert.equal(decoded.exp - decoded.iat, 7 * 24 * 60 * 60);
  assert.throws(() => generateToken(7), /credential/);
});

test("disposable guards reject isolation mismatches before any mutation", async () => {
  const env = { FINTRACK_DISPOSABLE_MYSQL: "true", FINTRACK_TEST_RUN_ID: "0123456789ab",
    DB_HOST: "127.0.0.1", DB_PORT: "13307", DB_NAME: "fintrack_test_0123456789ab", DB_USER: "fintrack_test_0123456789ab",
    DB_PASSWORD: "fintrack-test-synthetic", FINTRACK_TEST_DATADIR: "C:/tmp/fintrack-disposable/data",
    FINTRACK_TEST_SERVER_UUID: "synthetic-uuid", FINTRACK_TEST_NONCE: "synthetic-nonce" };
  for (const defect of ["host", "dataDir", "uuid", "db", "principal", "marker", "grant"]) {
    let mutations = 0;
    const connection = { async query(sql) {
      if (!/^(SELECT|SHOW)/.test(sql)) mutations++;
      if (sql.startsWith("SELECT @@")) return [[{ dataDir: defect === "dataDir" ? "C:/unrelated" : env.FINTRACK_TEST_DATADIR,
        uuid: defect === "uuid" ? "unrelated" : env.FINTRACK_TEST_SERVER_UUID, port: 13307,
        db: defect === "db" ? "unrelated" : env.DB_NAME,
        principal: defect === "principal" ? "root@localhost" : `${env.DB_USER}@127.0.0.1` }]];
      if (sql.includes("nonce")) return [[{ nonce: defect === "marker" ? "unrelated" : env.FINTRACK_TEST_NONCE }]];
      return [[{ Grants: defect === "grant" ? "GRANT ALL PRIVILEGES ON *.* TO root@localhost" : `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${env.DB_NAME}\`.* TO 'synthetic'` }]];
    } };
    await assert.rejects(assertDisposableIsolation(connection, { ...env, ...(defect === "host" ? { DB_HOST: "remote.invalid" } : {}) }));
    assert.equal(mutations, 0);
  }
});
