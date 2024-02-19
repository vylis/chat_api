/* eslint-disable no-console */
import http from "http";
import { Server } from "socket.io";

// redis
import redisClient from "../config/redis.js";
import redisSub from "../config/redisSub.js";

// mysql
import { poolPromise } from "../config/db.js";

// encrypt
import { encrypt, decrypt } from "./encrypt.js";

// SOCKET SERVER
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

  // SOCKET CONNECTION
  io.on("connection", (socket) => {
    // HANDLE ROOM CREATION
    socket.on("createRoom", async (room, user) => {
      // only usable by doctors/operators from TLS dashboard
      // check if room exists in db
      const sql = "SELECT * FROM user WHERE user_id = ?";
      const [existingRoom] = await poolPromise.execute(sql, [room.id]);

      // if it doesn't exist insert room in db
      if (existingRoom.length === 0) {
        const sql =
          "INSERT INTO room (name, created_at, is_active, owner_id) VALUES (?, NOW(), 1, ?)";
        const [rows] = await poolPromise.execute(sql, [room.name, user]);

        console.log("Inserted room:", rows.insertId);
      }
    });

    // HANDLE ROOM JOIN
    socket.on("joinRoom", async (room) => {
      socket.join(room);
    });

    // HANDLE ROOM CLOSING
    socket.on("closeRoom", async (room) => {
      // only usable by doctors/operators from TLS dashboard

      // update room in db
      const sql = "UPDATE room SET is_active = 0 WHERE room_id = ?";
      const [rows] = await poolPromise.execute(sql, [room.id]);

      console.log("Closing room:", rows.affectedRows);
    });

    // HANDLE MESSAGES
    socket.on("message", async (msg, room) => {
      const messageToStore = { ...msg, room };

      // encrypt message
      const encryptedMessage = encrypt(JSON.stringify(messageToStore));

      // store the message in Redis
      await redisClient.rpush(`messages:${room}`, encryptedMessage);

      // publish to 'messages' channel
      redisClient.publish("messages", encryptedMessage);

      // emit message to the sender to avoid duplicates
      socket.emit("message", msg);

      // emit message to everyone in the room except the sender
      socket.to(room).emit("message", msg);
    });

    // RETRIEVE MESSAGES
    socket.on("getMessages", async (room) => {
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

            // decrypt and parse message
            messages = messages.concat(
              keyMessages.map((message) => JSON.parse(decrypt(message))),
            );
          }
        } while (cursor !== "0");

        // emit messages to client
        socket.emit("messages", messages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    });

    // HANDLE MESSAGE READ
    socket.on("messageRead", async (message, user) => {
      // get user type
      const user_type = user.type === "doctor" ? "user_id" : "patient_user_id";

      //update message in db
      const sql = `UPDATE message SET is_read = 1 WHERE message_id = ? AND ${user_type} = ?`;
      const [rows] = await poolPromise.execute(sql, [message, user.sender.id]);

      console.log("Message read:", rows.affectedRows);
    });
  });

  // HANDLE INCOMING MESSAGES FROM REDIS 'MESSAGES' CHANNEL
  redisSubscriber.on("message", async (channel, message) => {
    // decrypt and parse message
    const parsedMessage = JSON.parse(decrypt(message));

    // get user type
    const user_type =
      parsedMessage.sender.type === "doctor" ? "user_id" : "patient_user_id";

    if (parsedMessage && parsedMessage.sender) {
      // store message in db
      const sql = `INSERT INTO message (message, created_at, ${user_type}, room_id, is_read) VALUES (?, NOW(), ?, ?, 0)`;
      const [rows] = await poolPromise.execute(sql, [
        encrypt(parsedMessage.message),
        parsedMessage.sender.id,
        parsedMessage.room,
      ]);

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
