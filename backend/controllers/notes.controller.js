const {
  projectExists,
  listNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
} = require("../services/dataService");
const { recordUserActivity } = require("../utils/auth");
const { validateNote, parseId } = require("../utils/validation");

async function listAllNotes(_req, res) {
  const result = await listNotes();
  res.json(result);
}

async function getNote(req, res) {
  const noteId = parseId(req.params.id);

  if (!noteId) {
    return res.status(400).json({ message: "Invalid note id." });
  }

  const note = await getNoteById(noteId);

  if (!note) {
    return res.status(404).json({ message: "Note not found." });
  }

  return res.json(note);
}

async function createNewNote(req, res) {
  const { errors, value } = validateNote(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  if (!(await projectExists(value.project_id))) {
    return res.status(400).json({ message: "Referenced project does not exist." });
  }

  const result = await createNote({
    ...value,
    owner_username: req.auth.user.username,
    owner_display_name: req.auth.user.displayName
  });
  if (result.data) {
    recordUserActivity({
      username: req.auth.user.username,
      displayName: req.auth.user.displayName,
      action: "create",
      entityType: "note",
      entityId: result.data.id,
      entityLabel: result.data.title
    });
  }
  return res.status(201).json(result);
}

async function updateExistingNote(req, res) {
  const noteId = parseId(req.params.id);

  if (!noteId) {
    return res.status(400).json({ message: "Invalid note id." });
  }

  const { errors, value } = validateNote(req.body);

  if (errors.length) {
    return res.status(400).json({ message: "Validation failed.", errors });
  }

  if (!(await projectExists(value.project_id))) {
    return res.status(400).json({ message: "Referenced project does not exist." });
  }

  const result = await updateNote(noteId, value);

  if (!result.data) {
    return res.status(404).json({ message: "Note not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "update",
    entityType: "note",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json(result);
}

async function removeNote(req, res) {
  const noteId = parseId(req.params.id);

  if (!noteId) {
    return res.status(400).json({ message: "Invalid note id." });
  }

  const result = await deleteNote(noteId);

  if (!result.data) {
    return res.status(404).json({ message: "Note not found." });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "delete",
    entityType: "note",
    entityId: result.data.id,
    entityLabel: result.data.title
  });
  return res.json({
    message: "Note deleted successfully.",
    ...result
  });
}

module.exports = {
  listAllNotes,
  getNote,
  createNewNote,
  updateExistingNote,
  removeNote
};
