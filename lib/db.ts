import { Pool } from "pg";

if (!process.env.DATABASE_KEY) {
  // In dev, log a warning once if DB is not configured.
  console.warn("DATABASE_KEY is not set; DB logging will be disabled.");
}

const pool =
  process.env.DATABASE_KEY != null
    ? new Pool({
        connectionString: process.env.DATABASE_KEY,
        max: 5,
      })
    : null;

type ClassificationRecord = {
  label: string;
  confidence?: number;
  reason?: string;
  cameraUrl?: string;
};

export async function logClassification(record: ClassificationRecord) {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS classifications (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      label TEXT NOT NULL,
      confidence DOUBLE PRECISION,
      reason TEXT,
      camera_url TEXT
    )
  `);

  await pool.query(
    `
      INSERT INTO classifications (label, confidence, reason, camera_url)
      VALUES ($1, $2, $3, $4)
    `,
    [record.label, record.confidence ?? null, record.reason ?? null, record.cameraUrl ?? null],
  );
}

export async function getRecentClassifications(limit = 20) {
  if (!pool) return [];

  const res = await pool.query(
    `
      SELECT id, created_at, label, confidence, reason, camera_url
      FROM classifications
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return res.rows as {
    id: number;
    created_at: string;
    label: string;
    confidence: number | null;
    reason: string | null;
    camera_url: string | null;
  }[];
}

export async function upsertCameraStatus(id: string, ip: string) {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS camera_status (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    `
      INSERT INTO camera_status (id, ip, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id)
      DO UPDATE SET ip = EXCLUDED.ip, updated_at = EXCLUDED.updated_at
    `,
    [id, ip],
  );
}

export async function getCameraStatus(id: string) {
  if (!pool) return null;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS camera_status (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const res = await pool.query(
    `
      SELECT id, ip, updated_at
      FROM camera_status
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  if (res.rows.length === 0) return null;

  return res.rows[0] as {
    id: string;
    ip: string;
    updated_at: string;
  };
}


