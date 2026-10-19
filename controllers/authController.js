import bcrypt from "bcrypt";

import { createUser, findUserByEmail } from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import db from "../config/db.js";
import { deleteOwnAccount } from "../services/accountPrivacyService.js";

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  // Email is a login identifier. Changing it requires a verified-email flow,
  // which this repository does not yet provide.
  if (email !== req.user.email) {
    throw new AppError("Email changes require verification and are not available yet. You can update your name.", 422);
  }
  const [result] = await db.execute("UPDATE users SET name = ? WHERE id = ?", [name, req.user.id]);
  if (result.affectedRows !== 1) throw new AppError("Account no longer exists. Please sign in again.", 401);
  res.json({ success: true, message: "Profile updated", data: { user: { ...req.user, name } } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await findUserByEmail(req.user.email);
  if (!user || !await bcrypt.compare(req.body.currentPassword, user.password)) {
    throw new AppError("Current password is incorrect. Please try again.", 403);
  }
  const password = await bcrypt.hash(req.body.newPassword, 10);
  const [result] = await db.execute(
    "UPDATE users SET password = ? WHERE id = ? AND password = ?", [password, req.user.id, user.password],
  );
  if (result.affectedRows !== 1) throw new AppError("Credentials changed. Please sign in and try again.", 409);
  res.json({ success: true, message: "Password updated. Please sign in again on all devices.", data: null });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await deleteOwnAccount(req.user.id, req.body.password);
  res.set("Cache-Control", "no-store");
  res.json({ success: true, message: "Account and associated data deleted from the active database", data: null });
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError("Email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const userId = await createUser(name, email, hashedPassword);

  const token = generateToken(userId, hashedPassword);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      token,
      user: {
        id: userId,
        name,
        email,
      },
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = generateToken(user.id, user.password);

  res.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    },
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "Profile fetched",
    data: {
      user: req.user,
    },
  });
});
