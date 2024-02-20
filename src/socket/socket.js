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
      // only usable by doctors/operators
      // check if room exists in db
      const sql = "SELECT * FROM user WHERE user_id = ?";
      const [existingRoom] = await poolPromise.execute(sql, [room.id]);

      // if it doesn't exist insert room in db
      if (existingRoom.length === 0) {
        const sql =
          "INSERT INTO room (name, created_at, is_active, owner_id) VALUES (?, NOW(), 1, ?)";
        await poolPromise.execute(sql, [room.name, user]);
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
      await poolPromise.execute(sql, [room.id]);
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
    socket.on("messageRead", async (message, user, room) => {
      // get user type from existing message
      const sender_user_type =
        message.sender.type === "doctor" ? "user_id" : "patient_user_id";

      // get message id from db and add 1 hour to date to match db timezone utc
      const date = new Date(message.createdAt);
      date.setHours(date.getHours() + 1);
      const created_at = date.toISOString().slice(0, 19).replace("T", " ");

      const selectSql = `SELECT * FROM message WHERE created_at = ? AND ${sender_user_type} = ? AND room_id = ? AND is_read = 0`;
      const [selectedRows] = await poolPromise.execute(selectSql, [
        created_at,
        message.sender.id,
        room,
      ]);

      // // get user type from receiver user
      const receiver_type = user.type === "doctor" ? "user_id" : "patient_user_id";

      for (const row of selectedRows) {
        if (user.id !== message.sender.id && row.is_read === 0) {
          const messageId = row.id;
          const sql = `UPDATE message SET is_read = 1, ${receiver_type} = ?, updated_at = NOW() WHERE id = ? AND is_read = 0`;
          const [rows] = await poolPromise.execute(sql, [user.id, messageId]);
          console.log("rows", rows.affectedRows);
        }
      }
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
      await poolPromise.execute(sql, [
        encrypt(parsedMessage.message),
        parsedMessage.sender.id,
        parsedMessage.room,
      ]);
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
