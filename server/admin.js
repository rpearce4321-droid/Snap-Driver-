import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";

export const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 5175);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(morgan("dev"));

/** Health */
app.get("/health", (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV ?? "dev" });
});

/** Helpers */
const parseCursor = (cursor) => (cursor ? { id: String(cursor) } : undefined);

/** Seekers list (default APPROVED, cursor-paged, optional query) */
app.get("/seekers", async (req, res) => {
  try {
    const { status = "APPROVED", take = 9, cursor, query: q } = req.query;

    const where = q
      ? {
          status,
          OR: [
            { firstName:  { contains: q, mode: "insensitive" } },
            { lastName:   { contains: q, mode: "insensitive" } },
            { companyDba: { contains: q, mode: "insensitive" } },
            { city:       { contains: q, mode: "insensitive" } },
            { state:      { contains: q, mode: "insensitive" } },
            { zip:        { contains: q, mode: "insensitive" } },
          ],
        }
      : { status };

    const items = await prisma.seekerProfile.findMany({
      where,
      take: Number(take),
      ...(cursor ? { skip: 1, cursor: parseCursor(cursor) } : {}),
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items,
      nextCursor: items.length ? items[items.length - 1].id : null,
    });
  } catch (err) {
    console.error("[/seekers]", err);
    res.status(500).json({ error: "Failed to fetch seekers" });
  }
});

/** Retainers list (default APPROVED, cursor-paged, optional query) */
app.get("/retainers", async (req, res) => {
  try {
    const { status = "APPROVED", take = 9, cursor, query: q } = req.query;

    const where = q
      ? {
          status,
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { mission:     { contains: q, mode: "insensitive" } },
            { city:        { contains: q, mode: "insensitive" } },
            { state:       { contains: q, mode: "insensitive" } },
          ],
        }
      : { status };

    const items = await prisma.retainerProfile.findMany({
      where,
      take: Number(take),
      ...(cursor ? { skip: 1, cursor: parseCursor(cursor) } : {}),
      orderBy: { createdAt: "desc" },
    });

    res.json({
      items,
      nextCursor: items.length ? items[items.length - 1].id : null,
    });
  } catch (err) {
    console.error("[/retainers]", err);
    res.status(500).json({ error: "Failed to fetch retainers" });
  }
});

/** Admin KPIs (status counts for both sides) */
app.get("/admin/kpis", async (_req, res) => {
  try {
    const [sp, sa, sr, ss, rp, ra, rr, rs] = await Promise.all([
      prisma.seekerProfile.count({ where: { status: "PENDING" } }),
      prisma.seekerProfile.count({ where: { status: "APPROVED" } }),
      prisma.seekerProfile.count({ where: { status: "REJECTED" } }),
      prisma.seekerProfile.count({ where: { status: "SUSPENDED" } }),
      prisma.retainerProfile.count({ where: { status: "PENDING" } }),
      prisma.retainerProfile.count({ where: { status: "APPROVED" } }),
      prisma.retainerProfile.count({ where: { status: "REJECTED" } }),
      prisma.retainerProfile.count({ where: { status: "SUSPENDED" } }),
    ]);
    res.json({
      seekers:   { pending: sp, approved: sa, rejected: sr, suspended: ss },
      retainers: { pending: rp, approved: ra, rejected: rr, suspended: rs },
    });
  } catch (err) {
    console.error("[/admin/kpis]", err);
    res.status(500).json({ error: "Failed to compute KPIs" });
  }
});

/** Mount admin moderation routes (if file exists) */
try {
  const { adminRouter } = await import("./admin.js");
  app.use("/admin", adminRouter);
  console.log("✅ Mounted admin moderation routes");
} catch {
  // admin.js is optional — skip if not found
}

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

