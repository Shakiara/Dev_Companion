const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { getSummary } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/summary", asyncHandler(getSummary));

module.exports = router;
