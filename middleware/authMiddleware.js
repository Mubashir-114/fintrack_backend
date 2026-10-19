import jwt from "jsonwebtoken";

import { findAuthUserById } from "../models/userModel.js";
import { matchesSessionBinding } from "../utils/sessionBinding.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Access denied. No token provided.", 401);
  }

  const token = authHeader.split(" ")[1];

  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  if (!Number.isSafeInteger(decoded.id) || decoded.id < 1 || typeof decoded.session !== "string") {
    throw new AppError("Session expired. Please sign in again.", 401);
  }

  const user = await findAuthUserById(decoded.id);

  if (!user) {
    throw new AppError("User not found.", 401);
  }

  if (!matchesSessionBinding(decoded.session, user.id, user.password)) {
    throw new AppError("Session expired. Please sign in again.", 401);
  }
  const { password, ...profile } = user;
  req.user = profile;

  next();
});

export default authMiddleware;
