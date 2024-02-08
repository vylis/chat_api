import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";

import socketServer from "./src/socket/socket.js";

dotenv.config();

const app = express();
const server = socketServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

server.listen(PORT, "0.0.0.0", () =>
  // eslint-disable-next-line no-console
  console.log(`Server and Socket running on port: ${PORT}`)
);
