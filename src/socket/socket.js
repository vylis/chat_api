/* eslint-disable no-console */
import http from "http";
import crypto from "crypto";
import { Server } from "socket.io";

// redis
import redisClient from "../config/redis.js";
import redisSub from "../config/redisSub.js";

// mysql
import { poolPromise } from "../config/db.js";

// encrypt/decrypt
const algo = "aes-256-cbc";
const encryptionSecret = process.env.ENCRYPTION_SECRET;

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

  // ENCRYPT FUNCTION
  const encrypt = (text) => {
    const IV_LENGTH = 16;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(algo, Buffer.from(encryptionSecret), iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return iv.toString("hex") + ":" + encrypted.toString("hex");
  };

  // DECRYPT FUNCTION
  const decrypt = (text) => {
    const [iv, encryptedText] = text.split(":");

    const decipher = crypto.createDecipheriv(
      algo,
      Buffer.from(encryptionSecret),
      Buffer.from(iv, "hex"),
    );

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "hex")),
      decipher.final(),
    ]);

    return decrypted.toString();
  };

  // SOCKET CONNECTION
  io.on("connection", (socket) => {
    // HANDLE ROOM
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
  });

  // HANDLE INCOMING MESSAGES FROM REDIS 'MESSAGES' CHANNEL
  redisSubscriber.on("message", async (channel, message) => {
    // decrypt and parse message
    const parsedMessage = JSON.parse(decrypt(message));

    if (parsedMessage && parsedMessage.sender) {
      // store message in db
      const [rows] = await poolPromise.execute(
        "INSERT INTO message (createdAt, message, user_id, room_id) VALUES (NOW(), ?, ?, ?)",
        [encrypt(parsedMessage.message), parsedMessage.sender.id, parsedMessage.room],
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
