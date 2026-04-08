const {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} = require("../services/dataService");
const { recordUserActivity } = require("../utils/auth");
const { validateProject, parseId } = require("../utils/validation");

async function listAllProjects(_req, res) {
  const result = await listProjects();
  res.json(result);
}

async function getProject(req, res) {
  const projectId = parseId(req.params.id);

  if (!projectId) {
    return res.status(400).json({ message: "Invalid project id." });
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }

  return res.json(project);
}

async function createNewProject(req, res) {
  const { errors, value } = validateProject(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  const result = await createProject({
    ...value,
    owner_username: req.auth.user.username,
    owner_display_name: req.auth.user.displayName
  });
  if (result.data) {
    recordUserActivity({
      username: req.auth.user.username,
      displayName: req.auth.user.displayName,
      action: "create",
      entityType: "project",
      entityId: result.data.id,
      entityLabel: result.data.title
    });
  }
  return res.status(201).json(result);
}

async function updateExistingProject(req, res) {
  const projectId = parseId(req.params.id);

  if (!projectId) {
    return res.status(400).json({ message: "Invalid project id." });
  }

  const { errors, value } = validateProject(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  const result = await updateProject(projectId, value);

  if (!result.data) {
    return res.status(404).json({ message: "Project not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "update",
    entityType: "project",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json(result);
}

async function removeProject(req, res) {
  const projectId = parseId(req.params.id);

  if (!projectId) {
    return res.status(400).json({ message: "Invalid project id." });
  }

  const result = await deleteProject(projectId);

  if (!result.data) {
    return res.status(404).json({ message: "Project not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "delete",
    entityType: "project",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json({
    message: "Project deleted successfully.",
    ...result
  });
}

module.exports = {
  listAllProjects,
  getProject,
  createNewProject,
  updateExistingProject,
  removeProject
};
