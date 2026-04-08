const { getSessionFromRequest } = require("../utils/auth");

function requireAuth(req, res, next) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.status(401).json({
      message: "Authentication required."
    });
  }

  req.auth = session;
  return next();
}

module.exports = { requireAuth };
