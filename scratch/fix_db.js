import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function fixSchema() {
  try {
    console.log("Altering column next_billing_date to be nullable...");
    await pool.query("ALTER TABLE subscriptions ALTER COLUMN next_billing_date DROP NOT NULL;");
    console.log("Successfully made next_billing_date nullable.");
  } catch (err) {
    console.error("Error altering table:", err);
  } finally {
    await pool.end();
  }
}

fixSchema();
