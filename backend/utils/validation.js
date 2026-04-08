const PROJECT_STATUSES = ["pending", "in_progress", "completed"];
const IDEA_PRIORITIES = ["low", "medium", "high"];
const ERROR_STATUSES = ["pending", "resolved"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeProjectId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function validateProject(payload) {
  const title = normalizeText(payload.title);
  const description = normalizeOptionalText(payload.description);
  const status = normalizeText(payload.status || "pending");
  const errors = [];

  if (!title) {
    errors.push("Title is required.");
  }

  if (!PROJECT_STATUSES.includes(status)) {
    errors.push("Status must be pending, in_progress, or completed.");
  }

  return {
    errors,
    value: { title, description, status }
  };
}

function validateIdea(payload) {
  const project_id = normalizeProjectId(payload.project_id);
  const title = normalizeText(payload.title);
  const description = normalizeOptionalText(payload.description);
  const category = normalizeOptionalText(payload.category);
  const priority = normalizeText(payload.priority || "medium");
  const errors = [];

  if (Number.isNaN(project_id)) {
    errors.push("Project id must be a positive number.");
  }

  if (!title) {
    errors.push("Title is required.");
  }

  if (!IDEA_PRIORITIES.includes(priority)) {
    errors.push("Priority must be low, medium, or high.");
  }

  return {
    errors,
    value: { project_id, title, description, category, priority }
  };
}

function validateErrorEntry(payload) {
  const project_id = normalizeProjectId(payload.project_id);
  const title = normalizeText(payload.title);
  const description = normalizeOptionalText(payload.description);
  const technology = normalizeOptionalText(payload.technology);
  const solution = normalizeOptionalText(payload.solution);
  const status = normalizeText(payload.status || "pending");
  const errors = [];

  if (Number.isNaN(project_id)) {
    errors.push("Project id must be a positive number.");
  }

  if (!title) {
    errors.push("Title is required.");
  }

  if (!ERROR_STATUSES.includes(status)) {
    errors.push("Status must be pending or resolved.");
  }

  return {
    errors,
    value: { project_id, title, description, technology, solution, status }
  };
}

function validateNote(payload) {
  const project_id = normalizeProjectId(payload.project_id);
  const title = normalizeText(payload.title);
  const content = normalizeText(payload.content);
  const topic = normalizeOptionalText(payload.topic);
  const errors = [];

  if (Number.isNaN(project_id)) {
    errors.push("Project id must be a positive number.");
  }

  if (!title) {
    errors.push("Title is required.");
  }

  if (!content) {
    errors.push("Content is required.");
  }

  return {
    errors,
    value: { project_id, title, content, topic }
  };
}

function parseId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  PROJECT_STATUSES,
  IDEA_PRIORITIES,
  ERROR_STATUSES,
  validateProject,
  validateIdea,
  validateErrorEntry,
  validateNote,
  parseId
};
