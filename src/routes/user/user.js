/* eslint-disable no-console */
import express from "express";

import { poolPromise } from "./mysql";
import { verifyToken } from "./middleware";

const router = express.Router();

// get user info
router.get("/", verifyToken, async (req, res) => {
  const userId = req.tokenDecoded.user_id;
  const pool = await poolPromise;
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users WHERE id = ?", [
      userId,
    ]);
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = rows[0];
    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
