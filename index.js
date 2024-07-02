const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const pool = require("./connection");
const jwt = require("jsonwebtoken");
var app = express();

app.use(bodyParser.json());

SECRET_KEY = "mysecretkey";

const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
};

// Middleware for checking JWT token
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization;

  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

const checkAdmin = (req, res, next) => {
  if (req.user.role === "admin") {
    next();
  } else {
    res.sendStatus(403);
    // 403: forbidden
  }
};

// Register a user
app.post("/api/signup", async (req, res) => {
  const { username, password, email, role = "user" } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)",
      [username, hashedPassword, email, role]
    );
    res.status(200).json({
      status: "Account successfully created",
      status_code: 200,
      user_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({
      status: "Account creation failed",
      status_code: 500,
    });
    console.error("Registration failed:", err);
  }
});

// Login a user
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (
      users.length === 0 ||
      !(await bcrypt.compare(password, users[0].password))
    ) {
      return res.status(401).json({
        status: "Incorrect username/password provided. Please retry",
        status_code: 401,
      });
    }

    const accessToken = jwt.sign(
      { id: users[0].id, role: users[0].role },
      SECRET_KEY,
      { expiresIn: "1h" }
    );
    res.status(200).json({
      status: "Login successful",
      status_code: 200,
      user_id: users[0].id,
      access_token: accessToken,
    });
  } catch (err) {
    res.status(500).json({
      status: "Login failed",
      status_code: 500,
    });
    console.error("Login failed:", err);
  }
});

// only admin can add the cars
app.post("/api/cars", authenticateJWT, checkAdmin, async (req, res) => {
  const car = req.body;
  try {
    const result = await query(
      "INSERT INTO cars (category, car_model, number_plate, current_city, rent_per_hr, rent_history) VALUES (?, ?, ?, ?, ?, ?)",
      [
        car.category,
        car.car_model,
        car.number_plate,
        car.current_city,
        car.rent_per_hr,
        JSON.stringify(car.rent_history || []),
      ]
    );
    res.status(200).json({
      status: "Car successfully added",
      status_code: 200,
      car_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({
      status: "Car addition failed",
      status_code: 500,
    });
    console.error("Car addition failed:", err);
  }
});

// Start the server

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
