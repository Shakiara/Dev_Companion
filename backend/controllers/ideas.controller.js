const {
  projectExists,
  listIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea
} = require("../services/dataService");
const { recordUserActivity } = require("../utils/auth");
const { validateIdea, parseId } = require("../utils/validation");

async function listAllIdeas(_req, res) {
  const result = await listIdeas();
  res.json(result);
}

async function getIdea(req, res) {
  const ideaId = parseId(req.params.id);

  if (!ideaId) {
    return res.status(400).json({ message: "Invalid idea id." });
  }

  const idea = await getIdeaById(ideaId);

  if (!idea) {
    return res.status(404).json({ message: "Idea not found." });
  }

  return res.json(idea);
}

async function createNewIdea(req, res) {
  const { errors, value } = validateIdea(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  if (!(await projectExists(value.project_id))) {
    return res.status(400).json({ message: "Referenced project does not exist." });
  }

  const result = await createIdea({
    ...value,
    owner_username: req.auth.user.username,
    owner_display_name: req.auth.user.displayName
  });
  if (result.data) {
    recordUserActivity({
      username: req.auth.user.username,
      displayName: req.auth.user.displayName,
      action: "create",
      entityType: "idea",
      entityId: result.data.id,
      entityLabel: result.data.title
    });
  }
  return res.status(201).json(result);
}

async function updateExistingIdea(req, res) {
  const ideaId = parseId(req.params.id);

  if (!ideaId) {
    return res.status(400).json({ message: "Invalid idea id." });
  }

  const { errors, value } = validateIdea(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  if (!(await projectExists(value.project_id))) {
    return res.status(400).json({ message: "Referenced project does not exist." });
  }

  const result = await updateIdea(ideaId, value);

  if (!result.data) {
    return res.status(404).json({ message: "Idea not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "update",
    entityType: "idea",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json(result);
}

async function removeIdea(req, res) {
  const ideaId = parseId(req.params.id);

  if (!ideaId) {
    return res.status(400).json({ message: "Invalid idea id." });
  }

  const result = await deleteIdea(ideaId);

  if (!result.data) {
    return res.status(404).json({ message: "Idea not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "delete",
    entityType: "idea",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json({
    message: "Idea deleted successfully.",
    ...result
  });
}

module.exports = {
  listAllIdeas,
  getIdea,
  createNewIdea,
  updateExistingIdea,
  removeIdea
};
