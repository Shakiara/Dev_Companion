const express = require("express");

const {
  getSessionStatus,
  login,
  register,
  startGoogleAuth,
  googleCallback,
  startGithubAuth,
  githubCallback,
  logout
} = require("../controllers/auth.controller");

const router = express.Router();

router.get("/session", getSessionStatus);
router.get("/google/start", startGoogleAuth);
router.get("/google/callback", googleCallback);
router.get("/github/start", startGithubAuth);
router.get("/github/callback", githubCallback);
router.post("/login", login);
router.post("/register", register);
router.post("/logout", logout);

module.exports = router;
