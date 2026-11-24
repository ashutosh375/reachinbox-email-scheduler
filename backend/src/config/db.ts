
import "dotenv/config";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function testDBConnection() {
  const result = await pool.query("SELECT NOW()");
  console.log("PostgreSQL connected:", result.rows[0]);
}
