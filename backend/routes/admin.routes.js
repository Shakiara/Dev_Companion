const express = require("express");

const { getAdminUsers, resetUserPassword, deleteUser } = require("../controllers/admin.controller");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/users", asyncHandler(getAdminUsers));
router.post("/users/:username/reset-password", asyncHandler(resetUserPassword));
router.delete("/users/:username", asyncHandler(deleteUser));

module.exports = router;
