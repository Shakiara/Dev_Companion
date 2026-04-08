const {
  projectExists,
  listErrors,
  getErrorById,
  createErrorEntry,
  updateErrorEntry,
  deleteErrorEntry
} = require("../services/dataService");
const { recordUserActivity } = require("../utils/auth");
const { validateErrorEntry, parseId } = require("../utils/validation");

async function listAllErrors(_req, res) {
  const result = await listErrors();
  res.json(result);
}

async function getError(req, res) {
  const errorId = parseId(req.params.id);

  if (!errorId) {
    return res.status(400).json({ message: "Invalid error id." });
  }

  const item = await getErrorById(errorId);

  if (!item) {
    return res.status(404).json({ message: "Error entry not found." });
  }

  return res.json(item);
}

async function createNewError(req, res) {
  const { errors, value } = validateErrorEntry(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  if (!(await projectExists(value.project_id))) {
    return res.status(400).json({ message: "Referenced project does not exist." });
  }

  const result = await createErrorEntry({
    ...value,
    owner_username: req.auth.user.username,
    owner_display_name: req.auth.user.displayName
  });
  if (result.data) {
    recordUserActivity({
      username: req.auth.user.username,
      displayName: req.auth.user.displayName,
      action: "create",
      entityType: "error",
      entityId: result.data.id,
      entityLabel: result.data.title
    });
  }
  return res.status(201).json(result);
}

async function updateExistingError(req, res) {
  const errorId = parseId(req.params.id);

  if (!errorId) {
    return res.status(400).json({ message: "Invalid error id." });
  }

  const { errors, value } = validateErrorEntry(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  if (!(await projectExists(value.project_id))) {
    return res.status(400).json({ message: "Referenced project does not exist." });
  }

  const result = await updateErrorEntry(errorId, value);

  if (!result.data) {
    return res.status(404).json({ message: "Error entry not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "update",
    entityType: "error",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json(result);
}

async function removeError(req, res) {
  const errorId = parseId(req.params.id);

  if (!errorId) {
    return res.status(400).json({ message: "Invalid error id." });
  }

  const result = await deleteErrorEntry(errorId);

  if (!result.data) {
    return res.status(404).json({ message: "Error entry not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "delete",
    entityType: "error",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json({
    message: "Error entry deleted successfully.",
    ...result
  });
}

module.exports = {
  listAllErrors,
  getError,
  createNewError,
  updateExistingError,
  removeError
};
