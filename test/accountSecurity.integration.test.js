import test from "node:test";
import assert from "node:assert/strict";

test("isolated MySQL: account APIs, session revocation, deletion rollback and tenant isolation", {
  skip: process.env.FINTRACK_DISPOSABLE_MYSQL !== "true" ? "Run node scripts/verifyAccountSecurity.js for a fresh identity-verified database" : false,
}, async t => {
  const { default: db } = await import("../config/db.js");
  const { assertDisposableIsolation } = await import("./support/disposableIsolation.js");
  // No data writes (including fixture setup) before this guard passes.
  await assertDisposableIsolation(db);
  const { default: express } = await import("express");
  const { default: bcrypt } = await import("bcrypt");
  const { default: jwt } = await import("jsonwebtoken");
  const { default: routes } = await import("../routes/authRoutes.js");
  const { default: errorHandler } = await import("../middleware/errorHandler.js");
  const { default: generateToken } = await import("../utils/generateToken.js");
  const { deleteOwnAccount, DELETION_TABLES } = await import("../services/accountPrivacyService.js");
  const password = "Synthetic-old-pass-123";
  const replacement = "Synthetic-new-pass-456";
  const controlPassword = "Synthetic-control-789";

  async function seed(email, secret) {
    const hash = await bcrypt.hash(secret, 4);
    const [user] = await db.execute("INSERT INTO users(name,email,password) VALUES ('Synthetic User',?,?)", [email, hash]);
    const id = user.insertId;
    const accountIds = [];
    for (let i = 0; i < 2; i++) {
      const [account] = await db.execute(`INSERT INTO accounts(user_id,type,subtype,display_name,opening_amount_minor,client_creation_key,creation_fingerprint)
        VALUES (?,'cash','cash','Synthetic wallet',12345,?,?)`, [id, `key-${id}-${i}`, "a".repeat(64)]);
      accountIds.push(account.insertId);
    }
    const [transaction] = await db.execute(`INSERT INTO transactions(user_id,category_id,account_id,type,title,amount,transaction_date)
      VALUES (?,3,?,'expense','Synthetic expense',12.34,'2026-10-19')`, [id, accountIds[0]]);
    await db.execute("INSERT INTO budgets(user_id,category_id,amount,month,year) VALUES (?,3,100.00,10,2026)", [id]);
    await db.execute(`INSERT INTO transfers(user_id,source_account_id,destination_account_id,amount_minor,transfer_date,client_transfer_key,transfer_fingerprint)
      VALUES (?,?,?,123,'2026-10-19',?,?)`, [id, ...accountIds, `transfer-${id}`, "b".repeat(64)]);
    await db.execute(`INSERT INTO account_adjustments(user_id,account_id,amount_minor,reason,adjustment_date,client_adjustment_key,adjustment_fingerprint)
      VALUES (?,?,10,'Synthetic correction','2026-10-19',?,?)`, [id, accountIds[0], `adjust-${id}`, "c".repeat(64)]);
    const [goal] = await db.execute("INSERT INTO savings_goals(user_id,name,target_amount) VALUES (?,'Synthetic goal',100.00)", [id]);
    await db.execute("INSERT INTO goal_contributions(goal_id,user_id,amount,contribution_date) VALUES (?,?,1.23,'2026-10-19')", [goal.insertId, id]);
    await db.execute("INSERT INTO user_companion_preferences(user_id,preferred_name,priority_goal_id) VALUES (?,'Synthetic FIN name',?)", [id, goal.insertId]);
    await db.execute(`INSERT INTO detected_transactions(user_id,account_id,category_id,amount,transaction_date,merchant_clean,sms_hash,confirmed_transaction_id)
      VALUES (?,?,3,12.34,'2026-10-19','Synthetic merchant',?,?)`, [id, accountIds[0], `sms-${id}`, transaction.insertId]);
    return { id, hash, email };
  }

  async function snapshot(id) {
    const result = {};
    for (const table of ["users", ...DELETION_TABLES]) {
      [result[table]] = await db.execute(`SELECT * FROM ${table} WHERE ${table === "users" ? "id" : "user_id"} = ? ORDER BY id`, [id]);
    }
    return result;
  }

  const app = express();
  app.use(express.json()); app.use("/api/auth", routes); app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  async function request(method, route, token, body) {
    const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }

  try {
    const owner = await seed("owner@example.test", password);
    const control = await seed("control@example.test", controlPassword);
    const controlBefore = await snapshot(control.id);
    const login = await request("POST", "/login", null, { email: owner.email, password });
    assert.equal(login.status, 200);
    const oldToken = login.body.data.token;
    const secondToken = generateToken(owner.id, owner.hash);
    const controlToken = generateToken(control.id, control.hash);

    await t.test("profile updates are real, owner scoped and never expose credentials", async () => {
      const changed = await request("PUT", "/me", oldToken, { name: "Updated synthetic name", email: owner.email, userId: control.id });
      assert.equal(changed.status, 200);
      assert.equal((await request("GET", "/me", oldToken)).body.data.user.name, "Updated synthetic name");
      assert.equal(JSON.stringify(changed.body).includes(owner.hash), false);
      assert.deepEqual(await snapshot(control.id), controlBefore);
      assert.equal((await request("PUT", "/me", oldToken, { name: "Updated synthetic name", email: control.email })).status, 422);
    });

    await t.test("password changes revoke every earlier token and reject old credentials", async () => {
      assert.equal((await request("PUT", "/password", oldToken, { currentPassword: "wrong", newPassword: replacement })).status, 403);
      assert.equal((await request("PUT", "/password", oldToken, { currentPassword: password, newPassword: replacement })).status, 200);
      for (const token of [oldToken, secondToken, jwt.sign({ id: owner.id }, process.env.JWT_SECRET)]) {
        assert.equal((await request("GET", "/me", token)).status, 401);
      }
      assert.equal((await request("POST", "/login", null, { email: owner.email, password })).status, 401);
    });
    const fresh = await request("POST", "/login", null, { email: owner.email, password: replacement });
    assert.equal(fresh.status, 200);
    const token = fresh.body.data.token;

    await t.test("unauthorized, invalid-confirmation and cross-user deletion do not mutate records", async () => {
      const before = await snapshot(owner.id);
      assert.equal((await request("DELETE", "/me", null, { password: replacement, confirmation: "DELETE" })).status, 401);
      assert.equal((await request("DELETE", "/me", token, { password: replacement, confirmation: "NO" })).status, 400);
      assert.equal((await request("DELETE", "/me", controlToken, { password: replacement, confirmation: "DELETE", userId: owner.id })).status, 403);
      assert.deepEqual(await snapshot(owner.id), before);
      assert.deepEqual(await snapshot(control.id), controlBefore);
    });

    await t.test("a failure after child deletions rolls back real InnoDB changes", async () => {
      const before = await snapshot(owner.id);
      const pool = { async getConnection() {
        const connection = await db.getConnection();
        return {
          beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(),
          rollback: () => connection.rollback(), release: () => connection.release(),
          execute(sql, values) {
            if (sql.startsWith("DELETE FROM transactions ")) throw new Error("Synthetic mid-transaction failure");
            return connection.execute(sql, values);
          },
        };
      } };
      await assert.rejects(deleteOwnAccount(owner.id, replacement, { pool }), /Synthetic mid-transaction/);
      assert.deepEqual(await snapshot(owner.id), before);
    });

    await t.test("cross-owner cascading references block deletion without modifying either user", async () => {
      const [[goal]] = await db.execute("SELECT id FROM savings_goals WHERE user_id = ?", [owner.id]);
      const [anomaly] = await db.execute("INSERT INTO goal_contributions(goal_id,user_id,amount,contribution_date) VALUES (?,?,2.34,'2026-10-19')", [goal.id, control.id]);
      const ownerBefore = await snapshot(owner.id);
      const withAnomaly = await snapshot(control.id);
      await assert.rejects(deleteOwnAccount(owner.id, replacement), { statusCode: 409 });
      assert.deepEqual(await snapshot(owner.id), ownerBefore);
      assert.deepEqual(await snapshot(control.id), withAnomaly);
      await db.execute("DELETE FROM goal_contributions WHERE id = ? AND user_id = ?", [anomaly.insertId, control.id]);
    });

    await t.test("confirmed deletion removes every child, invalidates tokens and preserves the other user's exact records", async () => {
      assert.equal((await request("DELETE", "/me", token, { password: replacement, confirmation: "DELETE" })).status, 200);
      for (const records of Object.values(await snapshot(owner.id))) assert.equal(records.length, 0);
      assert.deepEqual(await snapshot(control.id), controlBefore);
      assert.equal((await request("GET", "/me", token)).status, 401);
      assert.equal((await request("DELETE", "/me", token, { password: replacement, confirmation: "DELETE" })).status, 401);
      assert.equal((await request("GET", "/me", controlToken)).status, 200);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.end();
  }
});
