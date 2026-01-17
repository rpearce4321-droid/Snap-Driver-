// server/db/seed.js
import dotenv from "dotenv"
import pkg from "pg"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env (try server/.env, then project ./.env)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") })
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") })
}

if (!process.env.DATABASE_URL) {
  console.error("? DATABASE_URL is not set. Set it in server/.env (and copy to ./.env if needed).")
  process.exit(1)
}

const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
})

const schemaPath = path.resolve(__dirname, "schema.sql")
const seedPath   = path.resolve(__dirname, "seed.sql")
const schemaSql  = fs.readFileSync(schemaPath, "utf8")
const seedSql    = fs.readFileSync(seedPath, "utf8")

;(async () => {
  const client = await pool.connect()
  try {
    console.log("Applying schema…")
    await client.query(schemaSql)
    console.log("Seeding data…")
    await client.query(seedSql)
    console.log("? Database seeded successfully.")
  } catch (err) {
    console.error("? Seed failed:", err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
})()

