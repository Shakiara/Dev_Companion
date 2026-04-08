const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  listAllErrors,
  getError,
  createNewError,
  updateExistingError,
  removeError
} = require("../controllers/errors.controller");

const router = express.Router();

router.get("/", asyncHandler(listAllErrors));
router.get("/:id", asyncHandler(getError));
router.post("/", asyncHandler(createNewError));
router.put("/:id", asyncHandler(updateExistingError));
router.delete("/:id", asyncHandler(removeError));

module.exports = router;
