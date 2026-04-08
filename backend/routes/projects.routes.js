const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  listAllProjects,
  getProject,
  createNewProject,
  updateExistingProject,
  removeProject
} = require("../controllers/projects.controller");

const router = express.Router();

router.get("/", asyncHandler(listAllProjects));
router.get("/:id", asyncHandler(getProject));
router.post("/", asyncHandler(createNewProject));
router.put("/:id", asyncHandler(updateExistingProject));
router.delete("/:id", asyncHandler(removeProject));

module.exports = router;
