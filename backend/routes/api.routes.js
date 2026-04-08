const express = require("express");
const { getApiInfo } = require("../controllers/api.controller");

const router = express.Router();

router.get("/", getApiInfo);

module.exports = router;
