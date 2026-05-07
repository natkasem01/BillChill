import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bcrypt from 'bcryptjs'; // New: For scrambling passwords
import jwt from 'jsonwebtoken'; // New: For secure digital ID cards

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "billchill_super_secret_key"; // Fulfills security requirement

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// --- NEW: AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = user;
    next();
  });
};

// Database Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// --- NEW: AUTHENTICATION ROUTES ---

// 1. REGISTER: Create a new account with improved error handling
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Scramble the password for security
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Extract username from email
    const username = email.split('@')[0];

    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, username, hashedPassword]
    );

    res.status(201).json({
      message: "User created!",
      user: result.rows[0]
    });

  } catch (err) {
    console.error("Register Error:", err.message);

    // Check if the error is a "Unique Violation" (Postgres code 23505)
    if (err.code === '23505') {
      return res.status(400).json({
        error: "User already exists. Try a different email or log in!"
      });
    }

    res.status(500).json({ error: "Database error. Please try again later." });
  }
});
// 2. LOGIN: Sign in to get a secure token
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Create the "ID Card" (JWT)
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// --- EXISTING: SUBSCRIPTION ROUTES ---

// GET: Fetch all bills for the logged-in user
app.get('/subscriptions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, cost, next_billing_date, category FROM subscriptions WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// POST: Add a new bill (linked to the logged-in user)
app.post('/subscriptions', authenticateToken, async (req, res) => {
  try {
    const { name, cost, next_billing_date, category } = req.body;
    const user_id = req.user.id;

    if (!name || !cost) {
      return res.status(400).json({ error: "Name and Cost are required" });
    }

    const result = await pool.query(
      'INSERT INTO subscriptions (name, cost, next_billing_date, category, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, cost, next_billing_date || null, category || 'Entertainment', user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST Error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
});

// DELETE: Remove a bill
app.delete('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    res.json({ message: "Subscription deleted successfully!" });
  } catch (err) {
    console.error("DELETE Error:", err.message);
    res.status(500).send("Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is flying on port ${PORT}`);
});