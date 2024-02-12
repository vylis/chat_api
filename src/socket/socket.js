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

  io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`Socket joined room: ${room}`);
    });

    socket.on("message", async (msg, room) => {
      console.log(msg, room);
      // store the message in Redis
      const messageToStore = typeof msg === "object" ? JSON.stringify(msg) : msg;
      await redisClient.rpush(`messages:${room}`, messageToStore);

      // Emit the message only to the sender to avoid duplicates
      socket.emit("message", msg);

      // Emit the message to everyone in the room except the sender
      socket.to(room).emit("message", msg);
    });

    socket.on("getMessages", async (room) => {
      console.log("getMessages", room);
      // retrieve messages from Redis
      redisClient.lrange(`messages:${room}`, 0, -1, (err, messages) => {
        console.log("messages", messages);
        if (err) {
          console.error("Error fetching messages from Redis:", err);
          return;
        }
        const parsedMessages = messages.map((message) => JSON.parse(message));
        // Emit the messages to the requesting client
        socket.emit("messages", parsedMessages);
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
