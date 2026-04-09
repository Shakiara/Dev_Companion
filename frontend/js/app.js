const endpoints = {
  authLogin: "/api/auth/login",
  authRegister: "/api/auth/register",
  authLogout: "/api/auth/logout",
  authSession: "/api/auth/session",
  adminUsers: "/api/admin/users",
  adminResetPassword: (username) => `/api/admin/users/${encodeURIComponent(username)}/reset-password`,
  adminDeleteUser: (username) => `/api/admin/users/${encodeURIComponent(username)}`,
  adminStream: "/api/admin/stream",
  projects: "/api/projects",
  ideas: "/api/ideas",
  errors: "/api/errors",
  notes: "/api/notes",
  dashboard: "/api/dashboard/summary"
};

const state = {
  authMode: "signin",
  authenticated: false,
  user: null,
  source: "unknown",
  adminFilters: {
    search: "",
    provider: "all",
    username: "all"
  },
  adminSummary: null,
  adminUsers: [],
  authEvents: [],
  activityEvents: [],
  projects: [],
  ideas: [],
  errors: [],
  notes: [],
  dashboard: null
};

let adminEventSource = null;
let adminReloadTimer = null;

const authShell = document.getElementById("auth-shell");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const displayNameRow = document.getElementById("display-name-row");
const signinModeButton = document.getElementById("signin-mode-button");
const registerModeButton = document.getElementById("register-mode-button");
const loginFeedback = document.getElementById("login-feedback");
const logoutButton = document.getElementById("logout-button");
const sessionUserLabel = document.getElementById("session-user-label");
const usersNavButton = document.getElementById("users-nav-button");
const navButtons = document.querySelectorAll(".nav-button");
const sections = document.querySelectorAll(".section-panel");
const toggleButtons = document.querySelectorAll(".toggle-form-button");
const resetButtons = document.querySelectorAll(".reset-form-button");
const jumpButtons = document.querySelectorAll("[data-jump]");
const projectSelects = document.querySelectorAll("[data-project-select]");
const messageLabel = document.getElementById("app-message");
const sourceLabel = document.getElementById("data-source-label");
const dashboardHero = document.getElementById("dashboard-hero");
const statsGrid = document.getElementById("stats-grid");
const latestProject = document.getElementById("latest-project");
const dashboardActivity = document.getElementById("dashboard-activity");
const adminDashboardPanel = document.getElementById("admin-dashboard-panel");
const usersList = document.getElementById("users-list");
const authEventsList = document.getElementById("auth-events-list");
const activityEventsList = document.getElementById("activity-events-list");
const adminSummaryGrid = document.getElementById("admin-summary-grid");
const adminFeedback = document.getElementById("admin-feedback");
const adminSearchInput = document.getElementById("admin-search");
const adminProviderFilter = document.getElementById("admin-provider-filter");
const adminUserFilter = document.getElementById("admin-user-filter");
const feedbackByModule = {
  projects: document.querySelector('[data-feedback-for="projects"]'),
  ideas: document.querySelector('[data-feedback-for="ideas"]'),
  errors: document.querySelector('[data-feedback-for="errors"]'),
  notes: document.querySelector('[data-feedback-for="notes"]')
};
const listByModule = {
  projects: document.getElementById("projects-list"),
  ideas: document.getElementById("ideas-list"),
  errors: document.getElementById("errors-list"),
  notes: document.getElementById("notes-list")
};
const forms = {
  projects: document.getElementById("project-form"),
  ideas: document.getElementById("idea-form"),
  errors: document.getElementById("error-form"),
  notes: document.getElementById("note-form")
};

function showMessage(message) {
  messageLabel.textContent = message;
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === "register";

  authTitle.textContent = isRegister ? "Create your Dev Companion account" : "Sign in to Dev Companion";
  authSubtitle.textContent = isRegister
    ? "Create an account to start using the dashboard, projects, ideas, errors, and notes."
    : "You need an account session to access the dashboard, projects, ideas, errors, and notes.";
  displayNameRow.classList.toggle("hidden", !isRegister);
  signinModeButton.classList.toggle("active-mode", !isRegister);
  registerModeButton.classList.toggle("active-mode", isRegister);
  loginFeedback.textContent = "";
}

function showAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");

  if (!authError) {
    return;
  }

  loginFeedback.textContent = authError;
  params.delete("auth_error");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function showSection(sectionId) {
  if (sectionId === "users" && !state.user?.isAdmin) {
    sectionId = "dashboard";
  }

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  dashboardHero.classList.toggle("hidden", sectionId !== "dashboard");
}

function toggleForm(formId, visible) {
  const form = document.getElementById(formId);
  const shouldShow = typeof visible === "boolean" ? visible : form.classList.contains("hidden");
  form.classList.toggle("hidden", !shouldShow);
}

function getResponseData(payload) {
  return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload.errors?.join(" ") || payload.message || "Request failed.";
    throw new Error(message);
  }

  return payload;
}

function renderProjectSelects() {
  const options = [
    '<option value="">No linked project</option>',
    ...state.projects.map((project) => {
      return `<option value="${project.id}">${escapeHtml(project.title)}</option>`;
    })
  ].join("");

  projectSelects.forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = options;
    if (currentValue) {
      select.value = currentValue;
    }
  });
}

function renderStats() {
  const summary = state.dashboard;
  if (!summary) {
    statsGrid.innerHTML = "";
    return;
  }

  const stats = [
    { label: "Projects", value: summary.totalProjects },
    { label: "Ideas", value: summary.totalIdeas },
    { label: "Pending Errors", value: summary.pendingErrors },
    { label: "Notes", value: summary.totalNotes }
  ];

  statsGrid.innerHTML = stats
    .map((item) => {
      return `
        <article class="stat-card">
          <p class="pill">${escapeHtml(item.label)}</p>
          <strong>${escapeHtml(item.value)}</strong>
        </article>
      `;
    })
    .join("");
}

function renderAdminPanels() {
  usersNavButton.classList.toggle("hidden", !state.user?.isAdmin);
  adminDashboardPanel.classList.toggle("hidden", !state.user?.isAdmin);

  if (!state.user?.isAdmin) {
    adminSummaryGrid.innerHTML = "";
    adminFeedback.textContent = "";
    return;
  }

  const searchQuery = state.adminFilters.search.trim().toLowerCase();
  const providers = [...new Set(state.adminUsers.map((user) => user.authProvider || "local"))].sort();
  if (state.adminFilters.provider !== "all" && !providers.includes(state.adminFilters.provider)) {
    state.adminFilters.provider = "all";
  }
  if (state.adminFilters.username !== "all" && !state.adminUsers.some((user) => user.username === state.adminFilters.username)) {
    state.adminFilters.username = "all";
  }
  const providerFilter = state.adminFilters.provider;
  const usernameFilter = state.adminFilters.username;
  const matchesUser = (user) => {
    const matchesSearch = !searchQuery ||
      [user.displayName, user.username, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    const matchesProvider = providerFilter === "all" || (user.authProvider || "local") === providerFilter;
    const matchesUsername = usernameFilter === "all" || user.username === usernameFilter;
    return matchesSearch && matchesProvider && matchesUsername;
  };
  const filteredUsers = state.adminUsers.filter(matchesUser);
  const filteredAuthEvents = state.authEvents.filter((event) => {
    const matchesSearch = !searchQuery ||
      [event.displayName, event.username, event.provider, event.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    const matchesProvider = providerFilter === "all" || (event.provider || "local") === providerFilter;
    const matchesUsername = usernameFilter === "all" || event.username === usernameFilter;
    return matchesSearch && matchesProvider && matchesUsername;
  });
  const filteredActivityEvents = state.activityEvents.filter((event) => {
    const matchesSearch = !searchQuery ||
      [event.displayName, event.username, event.action, event.entityType, event.entityLabel, event.details]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    const matchesUsername = usernameFilter === "all" || event.username === usernameFilter;
    return matchesSearch && matchesUsername;
  });
  adminProviderFilter.innerHTML = [
    '<option value="all">All providers</option>',
    ...providers.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`)
  ].join("");
  adminProviderFilter.value = state.adminFilters.provider;

  adminUserFilter.innerHTML = [
    '<option value="all">All users</option>',
    ...state.adminUsers.map((user) => {
      return `<option value="${escapeHtml(user.username)}">${escapeHtml(user.displayName || user.username)} (${escapeHtml(user.username)})</option>`;
    })
  ].join("");
  adminUserFilter.value = state.adminFilters.username;

  const summary = state.adminSummary;
  if (summary) {
    const stats = [
      { label: "Total users", value: summary.totalUsers },
      { label: "Local", value: summary.localUsers },
      { label: "Google", value: summary.googleUsers },
      { label: "GitHub", value: summary.githubUsers },
      { label: "Sign-ins", value: summary.totalSignIns },
      { label: "Tracked actions", value: summary.totalActions }
    ];

    adminSummaryGrid.innerHTML = stats
      .map((item) => {
        return `
          <article class="stat-card">
            <p class="pill">${escapeHtml(item.label)}</p>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `;
      })
      .join("");
  } else {
    adminSummaryGrid.innerHTML = "";
  }

  if (!filteredUsers.length) {
    usersList.innerHTML = `<div class="empty-state compact"><p>${state.adminUsers.length ? "No users match the current filters." : "No users found yet."}</p></div>`;
  } else {
    usersList.innerHTML = filteredUsers
      .map((user) => {
        return `
          <article class="resource-card user-card">
            <div class="resource-top">
              <span class="tag-badge tag-neutral">${escapeHtml(user.authProvider || "local")}</span>
              <span class="resource-meta">${escapeHtml(user.canResetPassword ? "Local password can be reset" : "Managed by provider")}</span>
            </div>
            <strong>${escapeHtml(user.displayName || user.username)}</strong>
            <div class="user-details">
              <p class="resource-meta">Username: ${escapeHtml(user.username)}</p>
              <p class="resource-meta">Email: ${escapeHtml(user.email || "Not provided")}</p>
              <p class="resource-meta">Created: ${escapeHtml(formatDate(user.createdAt))}</p>
              <p class="resource-meta">Last sign-in: ${escapeHtml(formatDate(user.lastSignInAt))}</p>
              <p class="resource-meta">Sign-in method: ${escapeHtml(user.lastSignInProvider || user.authProvider || "local")}</p>
              <p class="resource-meta">Last activity: ${escapeHtml(user.lastActivitySummary || "No tracked actions yet")}</p>
              <p class="resource-meta">Last action at: ${escapeHtml(formatDate(user.lastActivityAt))}</p>
            </div>
            ${
              user.canResetPassword
                ? `
                  <div class="user-actions">
                    <form class="inline-form" data-admin-action="reset-password" data-username="${escapeHtml(user.username)}">
                      <label for="reset-password-${escapeHtml(user.username)}">Set new password</label>
                      <input
                        id="reset-password-${escapeHtml(user.username)}"
                        name="password"
                        type="password"
                        minlength="6"
                        placeholder="Enter a temporary password"
                        required
                      />
                      <button type="submit" class="secondary-button">Reset Password</button>
                    </form>
                    <button class="ghost-button danger-button" data-admin-delete-user="${escapeHtml(user.username)}">
                      Delete User
                    </button>
                  </div>
                `
                : `
                  <div class="user-actions">
                    <p class="resource-meta">This account signs in through ${escapeHtml(user.authProvider)}. Password changes must happen with that provider.</p>
                    <button class="ghost-button danger-button" data-admin-delete-user="${escapeHtml(user.username)}">
                      Delete User
                    </button>
                  </div>
                `
            }
          </article>
        `;
      })
      .join("");
  }

  if (!filteredAuthEvents.length) {
    authEventsList.innerHTML = `<div class="empty-state compact"><p>${state.authEvents.length ? "No sign-in activity matches the current filters." : "No sign-in activity yet."}</p></div>`;
  } else {
    authEventsList.innerHTML = filteredAuthEvents
      .map((event) => {
        return `
          <div class="activity-item">
            <strong>${escapeHtml(event.displayName || event.username || "Unknown user")}</strong>
            <p class="resource-meta">Username: ${escapeHtml(event.username || "Unknown")}</p>
            <p class="resource-meta">Method: ${escapeHtml(event.provider || "local")}</p>
            <p class="resource-meta">Type: ${escapeHtml(event.type || "login")}</p>
            <p class="resource-meta">At: ${escapeHtml(formatDate(event.createdAt))}</p>
          </div>
        `;
      })
      .join("");
  }

  if (!filteredActivityEvents.length) {
    activityEventsList.innerHTML = `<div class="empty-state compact"><p>${state.activityEvents.length ? "No tracked actions match the current filters." : "No tracked actions yet."}</p></div>`;
  } else {
    activityEventsList.innerHTML = filteredActivityEvents
      .map((event) => {
        return `
          <div class="activity-item">
            <strong>${escapeHtml(event.displayName || event.username || "Unknown user")}</strong>
            <p class="resource-meta">Username: ${escapeHtml(event.username || "Unknown")}</p>
            <p class="resource-meta">Action: ${escapeHtml(event.action || "activity")}</p>
            <p class="resource-meta">Area: ${escapeHtml(event.entityType || "workspace")}</p>
            <p class="resource-meta">Item: ${escapeHtml(event.entityLabel || "Not specified")}</p>
            <p class="resource-meta">At: ${escapeHtml(formatDate(event.createdAt))}</p>
          </div>
        `;
      })
      .join("");
  }
}

function renderLatestProject() {
  if (!state.dashboard?.latestProject) {
    latestProject.className = "dashboard-slot empty-state compact";
    latestProject.innerHTML = "<p>No projects yet.</p>";
    return;
  }

  const project = state.dashboard.latestProject;
  latestProject.className = "dashboard-slot dashboard-content";
  latestProject.innerHTML = `
    <span class="status-badge status-${escapeHtml(project.status)}">${escapeHtml(project.status.replace("_", " "))}</span>
    <strong>${escapeHtml(project.title)}</strong>
    <p>${escapeHtml(project.description || "No description yet.")}</p>
    <p class="resource-meta">Created ${escapeHtml(formatDate(project.created_at))}</p>
  `;
}

function renderActivity() {
  const activity = state.dashboard?.recentActivity;
  const hasItems = activity && Object.values(activity).some((items) => items.length);

  if (!activity || !hasItems) {
    dashboardActivity.innerHTML = '<div class="empty-state compact"><p>No activity yet.</p></div>';
    return;
  }

  const columns = [
    { title: "Projects", items: activity.projects || [], key: "status" },
    { title: "Ideas", items: activity.ideas || [], key: "priority" },
    { title: "Errors", items: activity.errors || [], key: "status" },
    { title: "Notes", items: activity.notes || [], key: "topic" }
  ];

  dashboardActivity.innerHTML = columns
    .map((column) => {
      const itemsMarkup = column.items.length
        ? column.items
            .map((item) => {
              const meta = item[column.key] || "recent";
              return `
                <div class="activity-item">
                  <strong>${escapeHtml(item.title)}</strong>
                  <p class="resource-meta">${escapeHtml(String(meta).replace("_", " "))}</p>
                </div>
              `;
            })
            .join("")
        : '<div class="activity-item"><p class="resource-meta">No items yet.</p></div>';

      return `
        <div class="activity-column">
          <p class="pill">${escapeHtml(column.title)}</p>
          ${itemsMarkup}
        </div>
      `;
    })
    .join("");
}

function buildCard(moduleName, item) {
  if (moduleName === "projects") {
    return `
      <article class="resource-card">
        <div class="resource-top">
          <span class="status-badge status-${escapeHtml(item.status)}">${escapeHtml(item.status.replace("_", " "))}</span>
          <div class="card-actions">
            <button class="ghost-button" data-action="edit" data-module="projects" data-id="${item.id}">Edit</button>
            <button class="ghost-button" data-action="delete" data-module="projects" data-id="${item.id}">Delete</button>
          </div>
        </div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.description || "No description yet.")}</p>
        <p class="resource-meta">Created ${escapeHtml(formatDate(item.created_at))}</p>
      </article>
    `;
  }

  if (moduleName === "ideas") {
    return `
      <article class="resource-card">
        <div class="resource-top">
          <span class="tag-badge priority-${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
          <div class="card-actions">
            <button class="ghost-button" data-action="edit" data-module="ideas" data-id="${item.id}">Edit</button>
            <button class="ghost-button" data-action="delete" data-module="ideas" data-id="${item.id}">Delete</button>
          </div>
        </div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.description || "No description yet.")}</p>
        <p class="resource-meta">Project: ${escapeHtml(item.project_title || "Unassigned")}</p>
        <p class="resource-meta">Category: ${escapeHtml(item.category || "General")}</p>
      </article>
    `;
  }

  if (moduleName === "errors") {
    return `
      <article class="resource-card">
        <div class="resource-top">
          <span class="status-badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          <div class="card-actions">
            <button class="ghost-button" data-action="edit" data-module="errors" data-id="${item.id}">Edit</button>
            <button class="ghost-button" data-action="delete" data-module="errors" data-id="${item.id}">Delete</button>
          </div>
        </div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.description || "No description yet.")}</p>
        <p class="resource-meta">Technology: ${escapeHtml(item.technology || "Not specified")}</p>
        <p class="resource-meta">Project: ${escapeHtml(item.project_title || "Unassigned")}</p>
      </article>
    `;
  }

  return `
    <article class="resource-card">
      <div class="resource-top">
        <span class="tag-badge tag-neutral">${escapeHtml(item.topic || "Note")}</span>
        <div class="card-actions">
          <button class="ghost-button" data-action="edit" data-module="notes" data-id="${item.id}">Edit</button>
          <button class="ghost-button" data-action="delete" data-module="notes" data-id="${item.id}">Delete</button>
        </div>
      </div>
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.content || "No content yet.")}</p>
      <p class="resource-meta">Project: ${escapeHtml(item.project_title || "Unassigned")}</p>
    </article>
  `;
}

function renderList(moduleName) {
  const container = listByModule[moduleName];
  const items = state[moduleName];

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No ${escapeHtml(moduleName)} yet. Create the first one from the form above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item) => buildCard(moduleName, item)).join("");
}

function renderAll() {
  sessionUserLabel.textContent = state.user
    ? `Signed in as ${state.user.username}`
    : "Signed in";
  sourceLabel.textContent = `Active: ${state.source}`;
  renderProjectSelects();
  renderStats();
  renderLatestProject();
  renderActivity();
  renderAdminPanels();
  renderList("projects");
  renderList("ideas");
  renderList("errors");
  renderList("notes");
}

function clearFeedback() {
  Object.values(feedbackByModule).forEach((node) => {
    node.textContent = "";
  });
}

function resetForm(moduleName) {
  const form = forms[moduleName];
  form.reset();
  form.elements.id.value = "";
  feedbackByModule[moduleName].textContent = "";
  form.classList.add("hidden");
}

function fillForm(moduleName, item) {
  const form = forms[moduleName];
  form.classList.remove("hidden");
  form.elements.id.value = item.id;

  Object.keys(item).forEach((key) => {
    if (form.elements[key]) {
      form.elements[key].value = item[key] ?? "";
    }
  });
}

async function loadModule(moduleName) {
  const payload = await fetchJson(endpoints[moduleName]);
  state[moduleName] = getResponseData(payload);
  state.source = payload.source || state.source;
}

async function loadDashboard() {
  const payload = await fetchJson(endpoints.dashboard);
  state.dashboard = getResponseData(payload);
  state.source = payload.source || state.source;
}

async function loadAdminPanels() {
  if (!state.user?.isAdmin) {
    state.adminSummary = null;
    state.adminUsers = [];
    state.authEvents = [];
    state.activityEvents = [];
    return;
  }

  const payload = await fetchJson(endpoints.adminUsers);
  const data = getResponseData(payload);
  state.adminSummary = data.summary || null;
  state.adminUsers = data.users || [];
  state.authEvents = data.authEvents || [];
  state.activityEvents = data.activityEvents || [];
}

function closeAdminStream() {
  if (adminEventSource) {
    adminEventSource.close();
    adminEventSource = null;
  }
}

function scheduleAdminRefresh() {
  if (adminReloadTimer) {
    return;
  }

  adminReloadTimer = window.setTimeout(async () => {
    adminReloadTimer = null;

    if (!state.user?.isAdmin) {
      return;
    }

    try {
      await loadAdminPanels();
      renderAdminPanels();
      adminFeedback.textContent = "Admin activity updated automatically.";
    } catch (error) {
      adminFeedback.textContent = "Unable to refresh admin activity automatically right now.";
    }
  }, 250);
}

function openAdminStream() {
  closeAdminStream();

  if (!state.user?.isAdmin) {
    return;
  }

  adminEventSource = new EventSource(endpoints.adminStream, {
    withCredentials: true
  });

  adminEventSource.addEventListener("admin-refresh", () => {
    scheduleAdminRefresh();
  });

  adminEventSource.onerror = () => {
    adminFeedback.textContent = "Reconnecting admin live updates...";
  };
}

async function loadApp() {
  showMessage("Loading workspace data...");
  clearFeedback();

  await Promise.all([
    loadModule("projects"),
    loadModule("ideas"),
    loadModule("errors"),
    loadModule("notes"),
    loadDashboard(),
    loadAdminPanels()
  ]);

  renderAll();
  const totalEntries = state.projects.length + state.ideas.length + state.errors.length + state.notes.length;
  showMessage(totalEntries ? "Workspace ready." : "Workspace ready for your first entry.");
}

function showAuthScreen() {
  authShell.classList.remove("hidden");
  appShell.classList.add("hidden");
  showAuthErrorFromUrl();
}

function showAppScreen() {
  authShell.classList.add("hidden");
  appShell.classList.remove("hidden");
}

async function checkSession() {
  const payload = await fetchJson(endpoints.authSession, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  state.authenticated = payload.authenticated;
  state.user = payload.user || null;
  return payload.authenticated;
}

async function boot() {
  showMessage("Checking session...");

  try {
    const authenticated = await checkSession();

    if (!authenticated) {
      showAuthScreen();
      return;
    }

    showAppScreen();
    await loadApp();
    openAdminStream();
  } catch (error) {
    showAuthScreen();
    loginFeedback.textContent = "Unable to verify session right now.";
  }
}

function getPayloadFromForm(moduleName, form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  delete payload.id;

  if ("project_id" in payload && !payload.project_id) {
    payload.project_id = null;
  }

  return payload;
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const moduleName = form.dataset.module;
  const recordId = form.elements.id.value;
  const payload = getPayloadFromForm(moduleName, form);
  const method = recordId ? "PUT" : "POST";
  const url = recordId ? `${endpoints[moduleName]}/${recordId}` : endpoints[moduleName];

  feedbackByModule[moduleName].textContent = "Saving...";

  try {
    await fetchJson(url, {
      method,
      body: JSON.stringify(payload)
    });

    await loadApp();
    resetForm(moduleName);
    showSection(moduleName);
    showMessage(`${moduleName.slice(0, -1)} saved successfully.`);
  } catch (error) {
    feedbackByModule[moduleName].textContent = error.message;
    showMessage(error.message);
  }
}

function findItem(moduleName, id) {
  return state[moduleName].find((item) => Number(item.id) === Number(id));
}

async function handleCardAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const { action, module, id } = button.dataset;
  const item = findItem(module, id);

  if (!item) {
    return;
  }

  if (action === "edit") {
    fillForm(module, item);
    feedbackByModule[module].textContent = "Editing existing record.";
    showSection(module);
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(`Delete this ${module.slice(0, -1)}?`);

    if (!confirmed) {
      return;
    }

    try {
      await fetchJson(`${endpoints[module]}/${id}`, {
        method: "DELETE"
      });

      await loadApp();
      showMessage(`${module.slice(0, -1)} deleted successfully.`);
    } catch (error) {
      showMessage(error.message);
    }
  }
}

async function handleAdminAction(event) {
  const deleteButton = event.target.closest("[data-admin-delete-user]");

  if (deleteButton) {
    const username = deleteButton.dataset.adminDeleteUser;
    const confirmed = window.confirm(
      `Delete ${username}? This will also remove their owned projects, ideas, errors, notes, and account history.`
    );

    if (!confirmed) {
      return;
    }

    adminFeedback.textContent = `Deleting ${username} and related data...`;

    try {
      const payload = await fetchJson(endpoints.adminDeleteUser(username), {
        method: "DELETE"
      });

      await loadApp();
      adminFeedback.textContent = payload.message || `Deleted ${username}.`;
      showSection("users");
    } catch (error) {
      adminFeedback.textContent = error.message;
    }

    return;
  }

  const form = event.target.closest("[data-admin-action='reset-password']");

  if (!form) {
    return;
  }

  event.preventDefault();

  const username = form.dataset.username;
  const password = String(new FormData(form).get("password") || "").trim();

  if (password.length < 6) {
    adminFeedback.textContent = "Temporary password must be at least 6 characters.";
    return;
  }

  adminFeedback.textContent = `Resetting password for ${username}...`;

  try {
    const payload = await fetchJson(endpoints.adminResetPassword(username), {
      method: "POST",
      body: JSON.stringify({ password })
    });

    form.reset();
    await loadApp();
    adminFeedback.textContent = payload.message || `Password updated for ${username}.`;
    showSection("users");
  } catch (error) {
    adminFeedback.textContent = error.message;
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showSection(button.closest(".section-panel").id);
    toggleForm(button.dataset.formTarget);
  });
});

resetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const formId = button.dataset.formTarget;
    const form = document.getElementById(formId);
    resetForm(form.dataset.module);
  });
});

jumpButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const target = button.dataset.jump;
    showSection(target);

    if (target === "dashboard") {
      await loadApp();
      return;
    }

    const formId = `${target.slice(0, -1)}-form`;
    if (document.getElementById(formId)) {
      toggleForm(formId, true);
    }
  });
});

Object.values(forms).forEach((form) => {
  form.addEventListener("submit", handleSubmit);
});

Object.values(listByModule).forEach((container) => {
  container.addEventListener("click", handleCardAction);
});

usersList.addEventListener("submit", handleAdminAction);
usersList.addEventListener("click", handleAdminAction);

adminSearchInput.addEventListener("input", (event) => {
  state.adminFilters.search = event.target.value;
  renderAdminPanels();
});

adminProviderFilter.addEventListener("change", (event) => {
  state.adminFilters.provider = event.target.value;
  renderAdminPanels();
});

adminUserFilter.addEventListener("change", (event) => {
  state.adminFilters.username = event.target.value;
  renderAdminPanels();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const displayName = String(formData.get("displayName") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const isRegister = state.authMode === "register";

  if ((isRegister && !displayName) || !username || !password) {
    loginFeedback.textContent = isRegister
      ? "Display name, username, and password are required."
      : "Username and password are required.";
    return;
  }

  loginFeedback.textContent = isRegister ? "Creating account..." : "Signing in...";

  try {
    const payload = await fetchJson(isRegister ? endpoints.authRegister : endpoints.authLogin, {
      method: "POST",
      body: JSON.stringify(
        isRegister ? { displayName, username, password } : { username, password }
      )
    });

    state.authenticated = true;
    state.user = payload.user;
    loginForm.reset();
    loginFeedback.textContent = "";
    showAppScreen();
    await loadApp();
    openAdminStream();
  } catch (error) {
    loginFeedback.textContent = error.message;
  }
});

signinModeButton.addEventListener("click", () => setAuthMode("signin"));
registerModeButton.addEventListener("click", () => setAuthMode("register"));

logoutButton.addEventListener("click", async () => {
  try {
    await fetchJson(endpoints.authLogout, {
      method: "POST"
    });
  } catch (error) {
    console.error(error);
  }

  state.authenticated = false;
  state.user = null;
  closeAdminStream();
  showAuthScreen();
  loginFeedback.textContent = "";
  showMessage("Sign in to continue.");
});

window.addEventListener("beforeunload", closeAdminStream);

boot().catch((error) => {
  showAuthScreen();
  loginFeedback.textContent = error.message || "Failed to load the application.";
});
