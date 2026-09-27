import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import documentsRouter from "./routes/documents";
import centersRoutes from "./routes/centers";
import profilesRouter from "./routes/profiles";
import feedbackRouter from "./routes/feedback";
import adminRouter from "./routes/admin";
import guestRouter, { sweepExpiredGuestJobs } from "./routes/guest";

const app = express();

// Requests arrive through the Next.js relay (and nginx in production);
// trust loopback proxies so req.ip is the real client address.
app.set("trust proxy", "loopback");

// Only needed when the browser calls the backend directly
// (NEXT_PUBLIC_API_BASE); the /backend relay is same-origin.
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-key"],
}));

app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// core app routes
app.use("/", documentsRouter);
app.use("/", centersRoutes);
app.use("/", profilesRouter);
app.use("/", feedbackRouter);
app.use("/", adminRouter);
app.use("/", guestRouter);

// auth router handles /auth/register, /auth/login, /auth/me, /auth/logout
app.use("/auth", authRouter);

// Unclaimed "try it" documents expire; sweep at startup and hourly.
sweepExpiredGuestJobs();
setInterval(sweepExpiredGuestJobs, 60 * 60 * 1000).unref();

const PORT = Number(process.env.PORT) || 4000;
// Localhost only by default: browsers reach the backend through the
// frontend's /backend relay. Set HOST=0.0.0.0 to expose it directly.
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Backend running on http://${HOST}:${PORT}`);
});
