import express from "express";

import { register, login, getProfile, updateProfile, changePassword, deleteAccount } from "../controllers/authController.js";
import rateLimit from "express-rate-limit";
import { profileValidation, passwordChangeValidation, deletionValidation } from "../validators/authValidation.js";

import {
  registerValidation,
  loginValidation,
} from "../validators/authValidation.js";

import authMiddleware from "../middleware/authMiddleware.js";
import validate from "../middleware/validate.js";

const router = express.Router();
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again in 15 minutes.", data: null },
});

router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.post("/register", credentialLimiter, registerValidation, validate, register);

router.post("/login", credentialLimiter, loginValidation, validate, login);

router.get("/me", authMiddleware, getProfile);
router.put("/me", authMiddleware, profileValidation, validate, updateProfile);
router.put("/password", authMiddleware, credentialLimiter, passwordChangeValidation, validate, changePassword);
router.delete("/me", authMiddleware, credentialLimiter, deletionValidation, validate, deleteAccount);

export default router;
