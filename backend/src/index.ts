import express from "express";
import cors from "cors";
import { optionalAuth } from "./middleware/auth";

import authRoutes from "./routes/auth";
import reportRoutes from "./routes/reports";
import proposalRoutes from "./routes/proposals";
import projectRoutes from "./routes/projects";
import commentRoutes from "./routes/comments";
import infrastructureRoutes from "./routes/infrastructure";
import statsRoutes from "./routes/stats";
import notificationRoutes from "./routes/notifications";
import simulationRoutes from "./routes/simulations";
import activityRoutes from "./routes/activities";
import transitRoutes from "./routes/transit";
import routePlannerRoutes from "./routes/routes";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(optionalAuth);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/infrastructure", infrastructureRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/simulations", simulationRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/transit", transitRoutes);
app.use("/api/routes", routePlannerRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`VeloCivic API running on http://localhost:${PORT}`);
});
