/* eslint-disable no-console */
import express from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

import { poolPromise } from "../../config/db.js";

// middleware
import { validatorRegister, validatorLogin } from "../../middleware/validatorLogin.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import { signToken } from "../../middleware/signToken.js";
dotenv.config();

const router = express.Router();

// swagger
/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: A message indicating successful registration
 *                 userId:
 *                   type: integer
 *                   description: The ID of the newly registered user
 *       400:
 *         description: Bad request or validation error
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in an existing user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User successfully logged in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: integer
 *                   description: The ID of the logged in user
 *                 token:
 *                   type: string
 *                   description: The authentication token for the user
 *       401:
 *         description: Unauthorized - Invalid username or password
 *       500:
 *         description: Internal server error
 */

// register user
router.post("/register", validatorRegister, async (req, res) => {
  const salt = await bcrypt.genSalt(10);
  const pool = await poolPromise;
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, salt);
    const query = "INSERT INTO users (username, password) VALUES (?, ?)";
    const result = await pool.query(query, [username, hashedPassword]);

    res.status(201).json({ message: "User registered", userId: result.insertId });
  } catch (e) {
    console.error("Error registering user:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// login user
router.post("/login", validatorLogin, signToken, verifyToken, async (req, res) => {
  const pool = await poolPromise;
  const { username, password } = req.body;
  try {
    const query = "SELECT * FROM users WHERE username = ?";
    const [rows] = await pool.query(query, [username]);

    if (rows.length === 0) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = req.token;
    res.status(200).json({ user_id: req.tokenDecoded.user_id, token: token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
