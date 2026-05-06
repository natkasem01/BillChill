import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import pg from 'pg';
import cors from 'cors'; // Added this line

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Added this line - now the frontend can talk to the backend!
app.use(express.json());
app.use(express.static('dist'));

// Database Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// GET ROUTE
app.get('/subscriptions', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, cost, next_billing_date, category FROM subscriptions');
    res.json(result.rows);
  } catch (err) {
    console.error("GET Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// POST ROUTE
app.post('/subscriptions', async (req, res) => {
  try {
    const { name, cost, next_billing_date, category } = req.body;

    if (!name || !cost) {
      return res.status(400).json({ error: "Name and Cost are required" });
    }

    const result = await pool.query(
      'INSERT INTO subscriptions (name, cost, next_billing_date, category, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, cost, next_billing_date || null, category || 'Entertainment', 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST Database Error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
});

// DELETE ROUTE - Ziya needs this for the delete buttons to work!
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