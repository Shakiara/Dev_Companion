const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  listAllNotes,
  getNote,
  createNewNote,
  updateExistingNote,
  removeNote
} = require("../controllers/notes.controller");

const router = express.Router();

router.get("/", asyncHandler(listAllNotes));
router.get("/:id", asyncHandler(getNote));
router.post("/", asyncHandler(createNewNote));
router.put("/:id", asyncHandler(updateExistingNote));
router.delete("/:id", asyncHandler(removeNote));

module.exports = router;
