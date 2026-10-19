// Test files that exercise the real (disposable) database must release the
// shared application pool, otherwise the idle pooled connections keep the
// node:test child process alive after every test has finished.
// Importing this module registers a root-level after() hook for the file.
import { after } from "node:test";
import db from "../../config/db.js";

after(async () => {
  try {
    await db.end();
  } catch {
    // Pool teardown must never mask the test results.
  }
});
