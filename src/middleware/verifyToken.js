/* eslint-disable no-console */
// middleware function to verify user token
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export function verifyToken(req, res, next) {
  const token = req.query.token || req.token;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.tokenDecoded = decoded;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
}

export default verifyToken;
