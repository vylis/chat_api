import redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisSub = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
});

export default redisSub;
