/* eslint-disable no-console */
import { Server } from "socket.io";
import http from "http";

// redis
import redisClient from "../config/redis.js";
import redisSub from "../config/redisSub.js";

// mysql
import { poolPromise } from "../config/db.js";

// create socket server
const socketServer = (app) => {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  // separate redis client for pub/sub
  const redisSubscriber = redisSub.duplicate();

  // subscribe to 'messages' channel
  redisSubscriber.subscribe("messages");

  io.on("connection", (socket) => {
    socket.on("joinRoom", async (room) => {
      socket.join(room);

      // check if room exists in db
      const [existingRoom] = await poolPromise.execute(
        "SELECT * FROM room WHERE name = ?",
        [room],
      );

      // if it doesn't exist insert room in db
      if (existingRoom.length === 0) {
        const [rows] = await poolPromise.execute(
          "INSERT INTO room (name, createdAt) VALUES (?, NOW())",
          [room],
        );

        console.log("Inserted room:", rows.insertId);
      }
    });

    socket.on("message", async (msg, room) => {
      // store the message in Redis
      const messageToStore = { ...msg, room };
      await redisClient.rpush(`messages:${room}`, JSON.stringify(messageToStore));

      // publish to 'messages' channel
      redisClient.publish("messages", JSON.stringify(messageToStore));

      // emit message to the sender to avoid duplicates
      socket.emit("message", msg);

      // emit message to everyone in the room except the sender
      socket.to(room).emit("message", msg);
    });

    socket.on("getMessages", async (room) => {
      // retrieve messages from Redis
      try {
        let messages = [];
        let cursor = "0";

        // pattern to match keys
        const pattern = `messages:${room}`;

        do {
          // scan keys matching pattern messages:room
          const [nextCursor, keys] = await redisClient.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            "100",
          );

          // update cursor for the next iteration
          cursor = nextCursor;

          // fetch messages associated with each key
          for (const key of keys) {
            const keyMessages = await redisClient.lrange(key, 0, -1);
            messages = messages.concat(keyMessages.map((message) => JSON.parse(message)));
          }
        } while (cursor !== "0");

        // emit messages to client
        socket.emit("messages", messages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    });
  });

  // handle incoming messages from 'messages' channel
  redisSubscriber.on("message", async (channel, message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage && parsedMessage.sender) {
      // store message in db
      const [rows] = await poolPromise.execute(
        "INSERT INTO message (createdAt, message, user_name, user_id, room_id) VALUES (NOW(), ?, ?, ?, ?)",
        [
          parsedMessage.message,
          parsedMessage.sender.name,
          parsedMessage.sender.id,
          parsedMessage.room,
        ],
      );

      console.log("Inserted message:", rows.insertId);
    } else {
      console.error("Invalid message format:", parsedMessage);
    }
  });

  redisClient.on("error", (err) => {
    console.error("Redis error:", err);
  });

  redisSubscriber.on("error", (err) => {
    console.error("Redis subscriber error:", err);
  });

  process.on("exit", () => {
    redisClient.quit();
    redisSubscriber.quit();
  });

  return server;
};

export default socketServer;
