import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import authRoutes from "../routes/authRoutes.js";
import errorHandler from "../middleware/errorHandler.js";
import { deleteOwnAccount, DELETION_TABLES } from "../services/accountPrivacyService.js";

function fixture({ exists = true, failTable } = {}) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id, password FROM users")) return [exists ? [{ id: 7, password: "hash" }] : []];
      if (sql.startsWith("SELECT")) return [[]];
      if (failTable && sql.includes(failTable)) throw new Error("schema unavailable");
      return [{ affectedRows: 1 }];
    },
  };
  return { calls, pool: { async getConnection() { return connection; } } };
}

test("deletion scopes every child mutation to the authenticated owner and commits once", async () => {
  const { pool, calls } = fixture();
  await deleteOwnAccount(7, "synthetic", { pool, compare: async () => true });
  const queries = calls.filter(c => typeof c === "object");
  const mutations = queries.filter(query => query.sql.startsWith("DELETE"));
  assert.equal(mutations.length, DELETION_TABLES.length + 1);
  for (const query of mutations) assert.deepEqual(query.params, [7]);
  assert.ok(queries[0].sql.endsWith("FOR UPDATE"));
  assert.equal(queries.at(-1).sql, "DELETE FROM users WHERE id = ?");
  assert.deepEqual(calls.slice(-2), ["commit", "release"]);
});

test("wrong password never deletes and rolls back", async () => {
  const { pool, calls } = fixture();
  await assert.rejects(deleteOwnAccount(7, "wrong", { pool, compare: async () => false }), { statusCode: 403 });
  assert.equal(calls.filter(c => c.sql?.startsWith("DELETE")).length, 0);
  assert.deepEqual(calls.slice(-2), ["rollback", "release"]);
});

test("duplicate deletion returns an error without simulating success", async () => {
  const { pool, calls } = fixture({ exists: false });
  await assert.rejects(deleteOwnAccount(7, "synthetic", { pool, compare: async () => true }), { statusCode: 401 });
  assert.ok(!calls.includes("commit"));
});

test("partial deletion or missing migration rolls back all changes", async () => {
  const { pool, calls } = fixture({ failTable: "transactions WHERE" });
  await assert.rejects(deleteOwnAccount(7, "synthetic", { pool, compare: async () => true }));
  assert.ok(!calls.includes("commit"));
  assert.deepEqual(calls.slice(-2), ["rollback", "release"]);
});

test("HTTP account endpoints reject missing auth, invalid confirmation, and redact both password fields", async () => {
  const original = db.execute;
  db.execute = async () => [[{ id: 7, name: "Synthetic User", email: "synthetic@example.test", password: "synthetic-hash" }]];
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  try {
    const unauthenticated = await fetch(`${base}/me`, { method: "DELETE" });
    assert.equal(unauthenticated.status, 401);
    const authorization = `Bearer ${generateToken(7, "synthetic-hash")}`;
    const invalid = await fetch(`${base}/me`, {
      method: "DELETE", headers: { authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "synthetic-password", confirmation: "NO" }),
    });
    assert.equal(invalid.status, 400);
    const password = await fetch(`${base}/password`, {
      method: "PUT", headers: { authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: { private: "secret-current" }, newPassword: "tiny" }),
    });
    assert.equal(password.status, 400);
    const body = await password.text();
    assert.ok(!body.includes("secret-current"));
    assert.ok(!body.includes("tiny"));
    assert.equal(password.headers.get("cache-control"), "no-store");
    const foreignEmail = await fetch(`${base}/me`, {
      method: "PUT", headers: { authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Synthetic User", email: "other@example.test" }),
    });
    assert.equal(foreignEmail.status, 422);
  } finally {
    db.execute = original;
    await new Promise(resolve => server.close(resolve));
  }
});
