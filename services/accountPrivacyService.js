import bcrypt from "bcrypt";
import db from "../config/db.js";
import AppError from "../utils/AppError.js";

// Child-first order matches migrations 0001–0007. Missing/incompatible schemas
// fail closed and roll back; never disable foreign keys or skip unknown data.
export const DELETION_TABLES = Object.freeze([
  "user_companion_preferences", "goal_contributions", "savings_goals",
  "detected_transactions", "transfers", "account_adjustments",
  "transactions", "budgets", "accounts",
]);

// These FKs can cascade/delete or SET NULL in another user's rows if historic
// data is inconsistent. Fail closed instead of silently changing their records.
const cascadingReferences = [
  ["goal_contributions", "goal_id", "savings_goals"],
  ["user_companion_preferences", "priority_goal_id", "savings_goals"],
  ["detected_transactions", "account_id", "accounts"],
  ["detected_transactions", "confirmed_transaction_id", "transactions"],
];

export async function deleteOwnAccount(userId, password, { pool = db, compare = bcrypt.compare } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      "SELECT id, password FROM users WHERE id = ? FOR UPDATE", [userId],
    );
    if (!users[0]) throw new AppError("Account no longer exists. Please sign out.", 401);
    if (!await compare(password, users[0].password)) {
      throw new AppError("Current password is incorrect. Please try again.", 403);
    }
    for (const [child, foreignKey, parent] of cascadingReferences) {
      const [references] = await connection.execute(
        `SELECT child.id FROM ${child} child JOIN ${parent} parent ON child.${foreignKey} = parent.id
         WHERE parent.user_id = ? AND child.user_id <> ? LIMIT 1 FOR UPDATE`, [userId, userId],
      );
      if (references.length) throw new AppError("Account deletion requires an integrity review. No records were deleted.", 409);
    }
    for (const table of DELETION_TABLES) {
      await connection.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    }
    const [result] = await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    if (result.affectedRows !== 1) throw new AppError("Account deletion could not be confirmed.", 409);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
