/* eslint-disable no-console */
import mysql from "mysql2";
import dotenv from "dotenv";
import { createRoomTable, createMessageTable } from "../utils/database.seed.js";

dotenv.config();

const pool = mysql.createPool({
  connectionLimit: 151,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

export const poolPromise = pool.promise();

// seed database
const seedDatabase = async () => {
  try {
    const connection = await poolPromise;
    await connection.query(createRoomTable);
    await connection.query(createMessageTable);
    console.log("Database seeded");
  } catch (err) {
    console.log("Error seeding database", err);
  }
};

seedDatabase();

export default pool;
