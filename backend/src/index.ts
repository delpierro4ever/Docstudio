import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import authRouter from "../src/routes/auth";
import documentsRouter from "../src/routes/documents";
import centersRoutes from "./routes/centers";
import profilesRouter from "./routes/profiles";

const app = express();

// Configure CORS properly for your frontend
app.use(cors({
  origin: "http://localhost:3000", // Your Next.js frontend URL
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-user-id"] // Add your custom headers
}));

app.use(bodyParser.json());

// core app routes
app.use("/", documentsRouter);
app.use("/", centersRoutes);
app.use("/", profilesRouter);

// single auth router handles /auth/register, /auth/login, /auth/me
app.use("/auth", authRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});