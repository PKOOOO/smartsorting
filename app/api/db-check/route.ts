import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * GET /api/db-check — Diagnose why the database connection fails.
 * Open http://localhost:3000/api/db-check in the browser to see the result.
 */
export async function GET() {
  const connStr = process.env.DATABASE_KEY;

  if (!connStr || connStr.length < 20) {
    return NextResponse.json({
      ok: false,
      message: "DATABASE_KEY is missing or too short in .env",
      hint: "Add DATABASE_KEY=postgresql://... to dashboard/.env",
    });
  }

  try {
    const sql = neon(connStr);
    const rows = await sql`SELECT 1 as ok`;

    if (rows.length > 0) {
      return NextResponse.json({
        ok: true,
        message: "Database connection successful.",
      });
    }

    return NextResponse.json({
      ok: false,
      message: "Query returned no rows.",
    });
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    const code = e?.code ?? "UNKNOWN";
    const message = e?.message ?? String(err);

    let hint = "";
    if (code === "ETIMEDOUT" || code === "ECONNREFUSED") {
      hint =
        "Your machine cannot reach Neon (firewall, no internet, or Neon host unreachable). Try from a different network.";
    } else if (code === "ENOTFOUND") {
      hint = "DNS could not resolve the Neon host. Check internet and try again.";
    } else if (message.includes("password") || message.includes("auth")) {
      hint = "Check DATABASE_KEY username and password in Neon dashboard.";
    } else if (message.includes("SSL") || message.includes("certificate")) {
      hint = "SSL issue. Ensure connection string includes ?sslmode=require";
    } else if (message.includes("channel_binding")) {
      hint = "Remove '&channel_binding=require' from DATABASE_KEY — it is not supported by this driver.";
    }

    return NextResponse.json({
      ok: false,
      code,
      message,
      hint: hint || "See Neon dashboard for project status and connection string.",
    });
  }
}
