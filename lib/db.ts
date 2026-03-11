import { neon } from "@neondatabase/serverless";

/* ------------------------------------------------------------------ */
/*  Connection                                                        */
/* ------------------------------------------------------------------ */

const DATABASE_KEY = process.env.DATABASE_KEY;

if (!DATABASE_KEY) {
  console.warn("DATABASE_KEY is not set; DB logging will be disabled.");
}

/**
 * Neon serverless driver – uses HTTP (SQL-over-HTTP), not raw TCP sockets.
 * This sidesteps the socket-level ETIMEDOUT / AggregateError issues that
 * the `pg` Pool hits when Neon is slow or channel_binding is requested.
 */
const sql = DATABASE_KEY ? neon(DATABASE_KEY) : null;

/* ------------------------------------------------------------------ */
/*  One-time table initialisation                                     */
/* ------------------------------------------------------------------ */

let tablesReady = false;

async function ensureTables() {
  if (tablesReady || !sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS classifications (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        label TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        reason TEXT,
        camera_url TEXT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS camera_status (
        id TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    tablesReady = true;
  } catch (err) {
    console.warn("ensureTables failed (will retry next call):", err);
  }
}

/* ------------------------------------------------------------------ */
/*  In-memory camera IP cache (works even when Neon is unreachable)   */
/* ------------------------------------------------------------------ */

const cameraIpCache = new Map<string, { ip: string; updatedAt: Date }>();

/* ------------------------------------------------------------------ */
/*  Classification helpers                                            */
/* ------------------------------------------------------------------ */

type ClassificationRecord = {
  label: string;
  confidence?: number;
  reason?: string;
  cameraUrl?: string;
};

export async function logClassification(record: ClassificationRecord) {
  if (!sql) return;
  try {
    await ensureTables();
    await sql`
      INSERT INTO classifications (label, confidence, reason, camera_url)
      VALUES (${record.label}, ${record.confidence ?? null}, ${record.reason ?? null}, ${record.cameraUrl ?? null})
    `;
  } catch (err) {
    console.warn("logClassification failed:", err);
  }
}

export async function getRecentClassifications(limit = 20) {
  if (!sql) return [];
  try {
    await ensureTables();
    const rows = await sql`
      SELECT id, created_at, label, confidence, reason, camera_url
      FROM classifications
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as {
      id: number;
      created_at: string;
      label: string;
      confidence: number | null;
      reason: string | null;
      camera_url: string | null;
    }[];
  } catch (err) {
    console.warn("getRecentClassifications failed:", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Camera status helpers                                             */
/* ------------------------------------------------------------------ */

export async function upsertCameraStatus(id: string, ip: string) {
  // Always write to memory first (instant, never fails)
  cameraIpCache.set(id, { ip, updatedAt: new Date() });

  if (!sql) return;
  try {
    await ensureTables();
    await sql`
      INSERT INTO camera_status (id, ip, updated_at)
      VALUES (${id}, ${ip}, NOW())
      ON CONFLICT (id)
      DO UPDATE SET ip = EXCLUDED.ip, updated_at = EXCLUDED.updated_at
    `;
  } catch (err) {
    console.warn("upsertCameraStatus DB write failed (in-memory is ok):", err);
  }
}

export async function getCameraStatus(id: string) {
  // 1. Check in-memory cache first (always up-to-date within this process)
  const cached = cameraIpCache.get(id);
  if (cached) {
    return {
      id,
      ip: cached.ip,
      updated_at: cached.updatedAt.toISOString(),
    };
  }

  // 2. Fall back to DB
  if (!sql) return null;
  try {
    await ensureTables();
    const rows = await sql`
      SELECT id, ip, updated_at
      FROM camera_status
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) return null;

    const row = rows[0] as { id: string; ip: string; updated_at: string };
    // Populate cache so subsequent reads don't hit DB
    cameraIpCache.set(id, { ip: row.ip, updatedAt: new Date(row.updated_at) });
    return row;
  } catch (err) {
    console.warn("getCameraStatus failed:", err);
    return null;
  }
}
