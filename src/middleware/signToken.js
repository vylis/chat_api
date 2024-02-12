// middleware function to sign user token
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export async function signToken(req, res, next) {
  const token = jwt.sign({ user_id: req.userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  req.token = token;
  next();
}

export default signToken;
