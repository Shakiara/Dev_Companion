const {
  findUser,
  createUserAccount,
  createOrUpdateOAuthUser,
  recordAuthEvent,
  verifyPassword,
  createSession,
  createOauthState,
  consumeOauthState,
  removeSession,
  getSessionFromRequest,
  buildSessionCookie,
  buildLogoutCookie,
  ensureAdminUser
} = require("../utils/auth");

ensureAdminUser();

function getBaseUrl(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = process.env.NODE_ENV === "production"
    ? forwardedProto || "https"
    : req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function getPublicBaseUrl(req) {
  return process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || getBaseUrl(req);
}

function getGoogleConfig(req) {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${getPublicBaseUrl(req)}/api/auth/google/callback`
  };
}

function getGithubConfig(req) {
  return {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri: process.env.GITHUB_REDIRECT_URI || `${getPublicBaseUrl(req)}/api/auth/github/callback`
  };
}

function redirectWithError(res, reason) {
  return res.redirect(`/?auth_error=${encodeURIComponent(reason)}`);
}

function getSessionStatus(req, res) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.json({
      authenticated: false
    });
  }

  return res.json({
    authenticated: true,
    user: session.user
  });
}

function login(req, res) {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required."
    });
  }

  const user = findUser(username);

  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({
      message: "Invalid credentials."
    });
  }

  const session = createSession(user);
  res.setHeader("Set-Cookie", buildSessionCookie(session.token));
  recordAuthEvent({
    type: "login",
    provider: user.authProvider || "local",
    username: user.username,
    displayName: user.displayName,
    email: user.email || null
  });

  return res.json({
    message: "Login successful.",
    user: {
      username: user.username,
      displayName: user.displayName,
      isAdmin: user.username === "admin"
    }
  });
}

function register(req, res) {
  const displayName = String(req.body.displayName || "").trim();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!displayName || !username || !password) {
    return res.status(400).json({
      message: "Display name, username, and password are required."
    });
  }

  if (displayName.length < 2) {
    return res.status(400).json({
      message: "Display name must be at least 2 characters."
    });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({
      message: "Username must be 3 to 20 characters and use only letters, numbers, or underscores."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters."
    });
  }

  const result = createUserAccount({
    username,
    displayName,
    password
  });

  if (result.error) {
    return res.status(409).json({
      message: result.error
    });
  }

  const session = createSession(result.user);
  res.setHeader("Set-Cookie", buildSessionCookie(session.token));
  recordAuthEvent({
    type: "register",
    provider: "local",
    username: result.user.username,
    displayName: result.user.displayName,
    email: result.user.email || null
  });

  return res.status(201).json({
    message: "Account created successfully.",
    user: {
      username: result.user.username,
      displayName: result.user.displayName,
      isAdmin: result.user.username === "admin"
    }
  });
}

function startGoogleAuth(req, res) {
  const config = getGoogleConfig(req);

  if (!config.clientId || !config.clientSecret) {
    return redirectWithError(res, "Google sign-in is not configured yet.");
  }

  const state = createOauthState("google");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

async function googleCallback(req, res) {
  const { code, state, error } = req.query;
  const config = getGoogleConfig(req);

  if (error) {
    return redirectWithError(res, "Google sign-in was cancelled or denied.");
  }

  if (!code || !state || !consumeOauthState(state, "google")) {
    return redirectWithError(res, "Google authentication failed.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code: String(code),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return redirectWithError(res, "Google token exchange failed.");
  }

  const tokenPayload = await tokenResponse.json();
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`
    }
  });

  if (!userResponse.ok) {
    return redirectWithError(res, "Google user lookup failed.");
  }

  const googleUser = await userResponse.json();
  const user = createOrUpdateOAuthUser({
    provider: "google",
    providerId: googleUser.sub,
    email: googleUser.email,
    username: googleUser.email || googleUser.name,
    displayName: googleUser.name || googleUser.email
  });

  const session = createSession(user);
  res.setHeader("Set-Cookie", buildSessionCookie(session.token));
  recordAuthEvent({
    type: "oauth_login",
    provider: "google",
    username: user.username,
    displayName: user.displayName,
    email: user.email || null
  });
  return res.redirect("/");
}

function startGithubAuth(req, res) {
  const config = getGithubConfig(req);

  if (!config.clientId || !config.clientSecret) {
    return redirectWithError(res, "GitHub sign-in is not configured yet.");
  }

  const state = createOauthState("github");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "read:user user:email",
    state
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

async function githubCallback(req, res) {
  const { code, state, error } = req.query;
  const config = getGithubConfig(req);

  if (error) {
    return redirectWithError(res, "GitHub sign-in was cancelled or denied.");
  }

  if (!code || !state || !consumeOauthState(state, "github")) {
    return redirectWithError(res, "GitHub authentication failed.");
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      code: String(code),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
    })
  });

  if (!tokenResponse.ok) {
    return redirectWithError(res, "GitHub token exchange failed.");
  }

  const tokenPayload = await tokenResponse.json();
  const [userResponse, emailResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Dev-Companion"
      }
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Dev-Companion"
      }
    })
  ]);

  if (!userResponse.ok) {
    return redirectWithError(res, "GitHub user lookup failed.");
  }

  const githubUser = await userResponse.json();
  const emails = emailResponse.ok ? await emailResponse.json() : [];
  const primaryEmail = Array.isArray(emails)
    ? emails.find((item) => item.primary)?.email || emails[0]?.email || null
    : null;

  const user = createOrUpdateOAuthUser({
    provider: "github",
    providerId: String(githubUser.id),
    email: primaryEmail,
    username: githubUser.login,
    displayName: githubUser.name || githubUser.login
  });

  const session = createSession(user);
  res.setHeader("Set-Cookie", buildSessionCookie(session.token));
  recordAuthEvent({
    type: "oauth_login",
    provider: "github",
    username: user.username,
    displayName: user.displayName,
    email: user.email || null
  });
  return res.redirect("/");
}

function logout(req, res) {
  const session = getSessionFromRequest(req);

  if (session) {
    removeSession(session.token);
  }

  res.setHeader("Set-Cookie", buildLogoutCookie());
  return res.json({
    message: "Logged out successfully."
  });
}

module.exports = {
  getSessionStatus,
  login,
  register,
  startGoogleAuth,
  googleCallback,
  startGithubAuth,
  githubCallback,
  logout
};
