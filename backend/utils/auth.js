const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SESSION_COOKIE = "dev_companion_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
const OAUTH_STATE_DURATION_MS = 1000 * 60 * 10;
const usersPath = path.join(__dirname, "..", "data", "users.json");
const authLogPath = path.join(__dirname, "..", "data", "auth-log.json");
const activityLogPath = path.join(__dirname, "..", "data", "activity-log.json");

const sessions = new Map();
const oauthStates = new Map();

function isAdminUsername(username) {
  return normalizeUsername(username) === "admin";
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function readUsers() {
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, "[]\n", "utf8");
  }

  const raw = fs.readFileSync(usersPath, "utf8");
  const users = JSON.parse(raw);
  return Array.isArray(users) ? users : [];
}

function writeUsers(users) {
  fs.writeFileSync(usersPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function readAuthLog() {
  if (!fs.existsSync(authLogPath)) {
    fs.writeFileSync(authLogPath, "[]\n", "utf8");
  }

  const raw = fs.readFileSync(authLogPath, "utf8");
  const events = JSON.parse(raw);
  return Array.isArray(events) ? events : [];
}

function writeAuthLog(events) {
  fs.writeFileSync(authLogPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
}

function readActivityLog() {
  if (!fs.existsSync(activityLogPath)) {
    fs.writeFileSync(activityLogPath, "[]\n", "utf8");
  }

  const raw = fs.readFileSync(activityLogPath, "utf8");
  const events = JSON.parse(raw);
  return Array.isArray(events) ? events : [];
}

function writeActivityLog(events) {
  fs.writeFileSync(activityLogPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
}

function ensureAdminUser() {
  const users = readUsers();
  const adminUser = users.find((user) => user.username === "admin");

  if (adminUser) {
    return;
  }

  users.push({
    username: "admin",
    displayName: "Admin",
    passwordHash: hashPassword("localhost"),
    authProvider: "local",
    createdAt: new Date().toISOString()
  });

  writeUsers(users);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function findUser(username) {
  ensureAdminUser();
  const normalizedUsername = normalizeUsername(username);
  return readUsers().find((user) => user.username.toLowerCase() === normalizedUsername) || null;
}

function createUserAccount({ username, displayName, password }) {
  ensureAdminUser();
  const users = readUsers();
  const normalizedUsername = normalizeUsername(username);

  if (users.some((user) => user.username.toLowerCase() === normalizedUsername)) {
    return { error: "Username already exists." };
  }

  const user = {
    username: normalizedUsername,
    displayName: String(displayName).trim(),
    passwordHash: hashPassword(password),
    authProvider: "local",
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeUsers(users);
  return { user };
}

function recordAuthEvent(event) {
  const events = readAuthLog();
  events.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...event
  });
  writeAuthLog(events.slice(0, 200));
}

function recordUserActivity(event) {
  const events = readActivityLog();
  events.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...event
  });
  writeActivityLog(events.slice(0, 400));
}

function makeUniqueUsername(baseUsername, users) {
  const normalizedBase = normalizeUsername(baseUsername).replace(/[^a-z0-9_]/g, "_") || "user";
  let candidate = normalizedBase;
  let suffix = 1;

  while (users.some((user) => user.username === candidate)) {
    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function createOrUpdateOAuthUser({ provider, providerId, email, username, displayName }) {
  ensureAdminUser();
  const users = readUsers();

  let user =
    users.find((item) => item.authProvider === provider && item.providerId === providerId) ||
    (email ? users.find((item) => item.email && item.email.toLowerCase() === email.toLowerCase()) : null);

  if (user) {
    user.displayName = displayName || user.displayName;
    user.email = email || user.email;
    user.authProvider = provider;
    user.providerId = providerId;
    writeUsers(users);
    return user;
  }

  user = {
    username: makeUniqueUsername(username || email?.split("@")[0] || provider, users),
    displayName: displayName || username || "User",
    authProvider: provider,
    providerId,
    email: email || null,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeUsers(users);
  return user;
}

function setLocalUserPassword(username, password) {
  ensureAdminUser();
  const users = readUsers();
  const normalizedUsername = normalizeUsername(username);
  const user = users.find((item) => item.username.toLowerCase() === normalizedUsername);

  if (!user) {
    return { error: "User not found." };
  }

  if ((user.authProvider || "local") !== "local") {
    return { error: "Only local accounts can have their password reset here." };
  }

  user.passwordHash = hashPassword(password);
  user.passwordUpdatedAt = new Date().toISOString();
  writeUsers(users);

  return {
    user: {
      username: user.username,
      displayName: user.displayName,
      authProvider: user.authProvider || "local",
      email: user.email || null,
      passwordUpdatedAt: user.passwordUpdatedAt
    }
  };
}

function removeSessionsForUsername(username) {
  const normalizedUsername = normalizeUsername(username);

  for (const [token, session] of sessions.entries()) {
    if (normalizeUsername(session.username) === normalizedUsername) {
      sessions.delete(token);
    }
  }
}

function deleteUserAccount(username) {
  ensureAdminUser();
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return { error: "Username is required." };
  }

  if (isAdminUsername(normalizedUsername)) {
    return { error: "Admin account cannot be deleted." };
  }

  const users = readUsers();
  const index = users.findIndex((item) => item.username.toLowerCase() === normalizedUsername);

  if (index === -1) {
    return { error: "User not found." };
  }

  const [deletedUser] = users.splice(index, 1);
  writeUsers(users);
  removeSessionsForUsername(deletedUser.username);

  return {
    user: {
      username: deletedUser.username,
      displayName: deletedUser.displayName,
      authProvider: deletedUser.authProvider || "local",
      email: deletedUser.email || null
    }
  };
}

function listVisibleUsers() {
  ensureAdminUser();
  const authEvents = readAuthLog();
  const activityEvents = readActivityLog();

  return readUsers()
    .filter((user) => !isAdminUsername(user.username))
    .map((user) => {
      const lastSignIn = authEvents.find((event) => event.username === user.username && event.type !== "register");
      const lastActivity = activityEvents.find((event) => event.username === user.username);

      return {
        username: user.username,
        displayName: user.displayName,
        authProvider: user.authProvider || "local",
        email: user.email || null,
        createdAt: user.createdAt || null,
        providerId: user.providerId || null,
        canResetPassword: (user.authProvider || "local") === "local",
        passwordUpdatedAt: user.passwordUpdatedAt || null,
        lastSignInAt: lastSignIn?.createdAt || null,
        lastSignInProvider: lastSignIn?.provider || user.authProvider || "local",
        lastActivityAt: lastActivity?.createdAt || null,
        lastActivitySummary: lastActivity
          ? `${lastActivity.action} ${lastActivity.entityType || "activity"}`
          : null
      };
    })
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
}

function listAuthEvents() {
  return readAuthLog().filter((event) => !isAdminUsername(event.username));
}

function listUserActivity() {
  return readActivityLog().filter((event) => !isAdminUsername(event.username));
}

function buildAdminSummary() {
  const users = listVisibleUsers();
  const authEvents = listAuthEvents();
  const activityEvents = listUserActivity();
  const publicAuthEvents = authEvents.filter((event) => !isAdminUsername(event.username));
  const publicActivityEvents = activityEvents.filter((event) => !isAdminUsername(event.username));

  return {
    totalUsers: users.length,
    localUsers: users.filter((user) => user.authProvider === "local").length,
    googleUsers: users.filter((user) => user.authProvider === "google").length,
    githubUsers: users.filter((user) => user.authProvider === "github").length,
    totalSignIns: publicAuthEvents.filter((event) => event.type === "login" || event.type === "oauth_login").length,
    totalActions: publicActivityEvents.length
  };
}

function purgeUserHistory(username) {
  const normalizedUsername = normalizeUsername(username);

  writeAuthLog(
    readAuthLog().filter((event) => normalizeUsername(event.username) !== normalizedUsername)
  );

  writeActivityLog(
    readActivityLog().filter((event) => normalizeUsername(event.username) !== normalizedUsername)
  );
}

function verifyPassword(user, password) {
  return user.passwordHash === hashPassword(password);
}

function createSession(user) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  sessions.set(token, {
    username: user.username,
    displayName: user.displayName,
    expiresAt
  });

  return {
    token,
    expiresAt
  };
}

function removeSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

function getSession(token) {
  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function createOauthState(provider) {
  const state = crypto.randomUUID();
  oauthStates.set(state, {
    provider,
    expiresAt: Date.now() + OAUTH_STATE_DURATION_MS
  });
  return state;
}

function consumeOauthState(state, provider) {
  const record = oauthStates.get(state);

  if (!record) {
    return false;
  }

  oauthStates.delete(state);

  if (record.provider !== provider) {
    return false;
  }

  return record.expiresAt > Date.now();
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, chunk) => {
    const trimmed = chunk.trim();

    if (!trimmed) {
      return cookies;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return cookies;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = decodeURIComponent(trimmed.slice(separatorIndex + 1).trim());
    cookies[key] = value;
    return cookies;
  }, {});
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  const session = getSession(token);

  if (!session) {
    return null;
  }

  return {
    token,
    user: {
      username: session.username,
      displayName: session.displayName,
      isAdmin: session.username === "admin"
    }
  };
}

function buildSessionCookie(token) {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  const secureFlag = process.env.NODE_ENV === "production" || String(process.env.APP_URL || "").startsWith("https://")
    ? "; Secure"
    : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

function buildLogoutCookie() {
  const secureFlag = process.env.NODE_ENV === "production" || String(process.env.APP_URL || "").startsWith("https://")
    ? "; Secure"
    : "";
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`;
}

module.exports = {
  SESSION_COOKIE,
  findUser,
  createUserAccount,
  listVisibleUsers,
  listAuthEvents,
  listUserActivity,
  buildAdminSummary,
  recordAuthEvent,
  recordUserActivity,
  createOrUpdateOAuthUser,
  setLocalUserPassword,
  deleteUserAccount,
  purgeUserHistory,
  verifyPassword,
  createSession,
  removeSession,
  createOauthState,
  consumeOauthState,
  getSessionFromRequest,
  buildSessionCookie,
  buildLogoutCookie,
  ensureAdminUser
};
