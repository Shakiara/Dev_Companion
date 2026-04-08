function getApiInfo(_req, res) {
  res.json({
    message: "Dev Companion API running",
    modules: ["projects", "ideas", "errors", "notes", "dashboard"],
    endpoints: {
      projects: "/api/projects",
      ideas: "/api/ideas",
      errors: "/api/errors",
      notes: "/api/notes",
      dashboard: "/api/dashboard/summary"
    }
  });
}

module.exports = { getApiInfo };
