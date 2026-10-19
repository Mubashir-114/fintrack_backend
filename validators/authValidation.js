import { body } from "express-validator";

export const profileValidation = [
  body("name").isString().bail().trim().isLength({ min: 3, max: 100 }),
  body("email").isString().bail().trim().isEmail().isLength({ max: 150 }),
];
export const passwordChangeValidation = [
  body("currentPassword").isString().bail().isLength({ min: 1, max: 100 }),
  body("newPassword").isString().bail().isLength({ min: 6, max: 100 })
    .custom(value => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
];
export const deletionValidation = [
  body("password").isString().bail().isLength({ min: 1, max: 100 }),
  body("confirmation").equals("DELETE").withMessage("Type DELETE to confirm account deletion"),
];

export const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Name must be between 3 and 100 characters"),

  body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("Valid email required")
    .isLength({ max: 150 })
    .withMessage("Email must not exceed 150 characters"),

  body("password")
    .isString()
    .withMessage("Password must be a string")
    .isLength({ min: 6, max: 100 })
    .withMessage("Password must be between 6 and 100 characters")
    .bail()
    .custom(value => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
];

export const loginValidation = [
  body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("Valid email required"),

  body("password")
    .isString()
    .withMessage("Password must be a string")
    .notEmpty()
    .withMessage("Password required"),
];
