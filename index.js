import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

// swagger
import basicAuth from "express-basic-auth";
import swaggerUI from "swagger-ui-express";
import swaggerJsDoc from "swagger-jsdoc";

// socket
import socketServer from "./src/socket/socket.js";

// routes
import router from "./src/routes/router.js";

const app = express();
const server = socketServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: "5000mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

app.use("/", router);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// swagger
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "chat_api",
      version: "v1.0",
      description: "",
    },
    servers: [
      {
        url: "",
        description: "chat_api",
      },
    ],
  },
  apis: ["./index.js", "./src/routes/auth/auth.js"],
};

const specs = swaggerJsDoc(options);

app.use(
  "/docs",
  basicAuth({ users: { auth: "auth" }, challenge: true }),
  swaggerUI.serve,
  swaggerUI.setup(specs),
);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *      bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// server
app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

server.listen(PORT, "0.0.0.0", () =>
  // eslint-disable-next-line no-console
  console.log(`Server and Socket running on port: ${PORT}`),
);
