/* eslint-disable no-console */
import { poolPromise } from "../config/db.js";

export async function validatorRegister(req, res, next) {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      const err = new Error("Username or password is empty");
      err.statusCode = 400;
      throw err;
    }

    const pool = await poolPromise;
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length > 0) {
      const err = new Error("User already exists");
      err.statusCode = 400;
      throw err;
    }

    next();
  } catch (error) {
    console.error("Error validating user:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" });
  }
}

export async function validatorLogin(req, res, next) {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      const err = new Error("Username or password is empty");
      err.statusCode = 400;
      throw err;
    }

    const pool = await poolPromise;
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      const err = new Error("Invalid credentials");
      err.statusCode = 400;
      throw err;
    }

    next();
  } catch (error) {
    console.error("Error validating user login:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal server error" });
  }
}

export default { validatorRegister, validatorLogin };
