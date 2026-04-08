const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  listAllIdeas,
  getIdea,
  createNewIdea,
  updateExistingIdea,
  removeIdea
} = require("../controllers/ideas.controller");

const router = express.Router();

router.get("/", asyncHandler(listAllIdeas));
router.get("/:id", asyncHandler(getIdea));
router.post("/", asyncHandler(createNewIdea));
router.put("/:id", asyncHandler(updateExistingIdea));
router.delete("/:id", asyncHandler(removeIdea));

module.exports = router;
