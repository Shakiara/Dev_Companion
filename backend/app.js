require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const { requireAuth } = require("./middleware/requireAuth");
const { requireAdmin } = require("./middleware/requireAdmin");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const apiRoutes = require("./routes/api.routes");
const projectRoutes = require("./routes/projects.routes");
const ideaRoutes = require("./routes/ideas.routes");
const errorRoutes = require("./routes/errors.routes");
const noteRoutes = require("./routes/notes.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use("/css", express.static(path.join(__dirname, "..", "frontend", "css")));
app.use("/js", express.static(path.join(__dirname, "..", "frontend", "js")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    app: "Dev Companion"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", requireAuth);
app.use("/api/admin", requireAdmin, adminRoutes);
app.use("/api", apiRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/ideas", ideaRoutes);
app.use("/api/errors", errorRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Internal server error.",
    detail: error.message
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Dev Companion running on http://${HOST}:${PORT}`);
});
