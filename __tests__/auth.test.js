const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../app.js");
const fs = require("fs");
const path = require("path");

describe("POST /register", () => {
  let user;

  it("should register a new user and return user id and token", async () => {
    const res = await request(app).post("/register").send({
      username: "testuser",
      password: "testpassword",
    });

    user = res.body.user_id;

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("user_id");
    expect(res.body).toHaveProperty("token");
  });

  it("should return 500 if an error occurs while registering a new user", async () => {
    // mock an error in the bcrypt.hash function
    jest.spyOn(bcrypt, "hash").mockImplementation(() => {
      throw new Error();
    });

    const res = await request(app).post("/register").send({});

    expect(res.statusCode).toEqual(500);
    expect(res.body).toEqual({ msg: "Internal server error" });

    // restore the original function
    bcrypt.hash.mockRestore();
  });

  afterAll(() => {
    const dbPath = path.join(__dirname, "..", "config", "db.json");
    const dbData = JSON.parse(fs.readFileSync(dbPath, "utf8"));

    const updatedDb = dbData.filter((userObj) => userObj.id !== user);

    fs.writeFileSync(dbPath, JSON.stringify(updatedDb));
  });
});

describe("POST /login", () => {
  let user;

  beforeAll(async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("testpassword", salt);

    user = {
      id: 1,
      username: "testuser",
      password: hashedPassword,
    };

    const dbData = JSON.parse(fs.readFileSync("./config/db.json", "utf8"));
    dbData.push(user);
    fs.writeFileSync("./config/db.json", JSON.stringify(dbData));
  });

  it("should log in a user and return user id and token", async () => {
    const res = await request(app).post("/login").send({
      username: "testuser",
      password: "testpassword",
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("user_id");
    expect(res.body).toHaveProperty("token");
  });

  it("should return 400 if the credentials are incorrect", async () => {
    const res = await request(app).post("/login").send({
      username: "testuser",
      password: "incorrectpassword",
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toEqual({ msg: "Credentials not matching in database" });
  });

  afterAll(() => {
    const dbData = JSON.parse(fs.readFileSync("./config/db.json", "utf8"));
    const updatedDb = dbData.filter((userObj) => userObj.id !== user.id);
    fs.writeFileSync("./config/db.json", JSON.stringify(updatedDb));
  });
});
