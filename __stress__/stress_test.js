/* eslint-disable no-console */
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:4004";
const ROOM_ID = "1";
const SENDER_ID = 3;
const SENDER_NAME = "Stress Tester JS";

const sio = io(SERVER_URL, {
  transports: ["websocket"],
});

// join room
const joinRoom = () => {
  sio.emit("joinRoom", ROOM_ID);
};

// emit messages
const emitMessages = () => {
  setInterval(() => {
    const messagePayload = {
      message: "This is a stress test",
      createdAt: new Date().toISOString(),
      sender: { id: SENDER_ID, name: SENDER_NAME },
    };

    sio.emit("message", messagePayload, ROOM_ID);
    // eslint-disable-next-line no-console
    console.log("Message emitted via Socket.IO");
  }, 1000);
};

// connect to server
sio.on("connect", () => {
  console.log("Socket.IO connected");
  joinRoom();
});

// disconnect from server
sio.on("disconnect", () => {
  console.log("Socket.IO disconnected");
});

// start the client and the message emitting function
emitMessages();
