/* eslint-disable no-console */
import { Server } from "socket.io";
import http from "http";
import redisClient from "../config/redis.js";

const socketServer = (app) => {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket, id) => {
    console.log("a user connected");

    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`Socket joined room: ${room}`);
    });

    socket.on("message", async (msg, id) => {
      console.log(msg, id);
      // Store the message in Redis
      await redisClient.rpush(`messages:${id}`, msg);
      io.to(id).emit("message", msg);
    });

    socket.on("getMessages", async (id) => {
      console.log("getMessages", id);
      // Retrieve messages from Redis
      redisClient.lrange(`messages:${id}`, 0, -1, (err, messages) => {
        if (err) {
          console.error("Error fetching messages from Redis:", err);
          return;
        }
        io.to(id).emit("messages", messages);
      });
    });
  });

  redisClient.on("error", (err) => {
    console.error("Redis Error:", err);
  });

  process.on("exit", () => {
    redisClient.quit();
  });

  return server;
};

export default socketServer;
