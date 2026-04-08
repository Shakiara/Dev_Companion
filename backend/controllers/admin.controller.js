const {
  listVisibleUsers,
  listAuthEvents,
  listUserActivity,
  buildAdminSummary,
  setLocalUserPassword,
  recordUserActivity,
  deleteUserAccount,
  purgeUserHistory
} = require("../utils/auth");
const { deleteUserWorkspaceContent } = require("../services/dataService");

function getAdminUsers(_req, res) {
  return res.json({
    data: {
      summary: buildAdminSummary(),
      users: listVisibleUsers(),
      authEvents: listAuthEvents(),
      activityEvents: listUserActivity()
    }
  });
}

function resetUserPassword(req, res) {
  const username = String(req.params.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username) {
    return res.status(400).json({
      message: "Username is required."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "New password must be at least 6 characters."
    });
  }

  const result = setLocalUserPassword(username, password);

  if (result.error) {
    const status = result.error === "User not found." ? 404 : 400;
    return res.status(status).json({
      message: result.error
    });
  }

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "reset_password",
    entityType: "user",
    entityLabel: username,
    details: `Admin reset password for ${username}`
  });

  return res.json({
    message: `Password updated for ${username}.`,
    data: result.user
  });
}

async function deleteUser(req, res) {
  const username = String(req.params.username || "").trim();

  if (!username) {
    return res.status(400).json({
      message: "Username is required."
    });
  }

  const deletion = deleteUserAccount(username);

  if (deletion.error) {
    const status = deletion.error === "User not found." ? 404 : 400;
    return res.status(status).json({
      message: deletion.error
    });
  }

  const workspaceResult = await deleteUserWorkspaceContent(username);
  purgeUserHistory(username);

  recordUserActivity({
    username: req.auth.user.username,
    displayName: req.auth.user.displayName,
    action: "delete_user",
    entityType: "user",
    entityLabel: username,
    details: `Admin deleted ${username} and related workspace content`
  });

  return res.json({
    message: `User ${username} and related data were deleted.`,
    data: {
      user: deletion.user,
      deletedContent: workspaceResult.data
    }
  });
}

module.exports = { getAdminUsers, resetUserPassword, deleteUser };
