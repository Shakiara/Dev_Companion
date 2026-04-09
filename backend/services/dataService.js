const { getPool, getDataProvider } = require("../config/db");
const {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  deleteItemsOwnedByUsername,
  buildSummary
} = require("../data/fileStore");

async function tryMysql(work) {
  const pool = getPool();
  return work(pool);
}

async function withFallback(mysqlWork, fileWork) {
  const provider = getDataProvider();

  if (provider === "file") {
    const data = await fileWork();
    return { data, source: "file" };
  }

  if (provider === "mysql") {
    const data = await tryMysql(mysqlWork);
    return { data, source: "mysql" };
  }

  try {
    const data = await tryMysql(mysqlWork);
    return { data, source: "mysql" };
  } catch (error) {
    const data = await fileWork();
    return { data, source: "file", info: "MySQL unavailable. Using local file storage." };
  }
}

async function projectExists(projectId) {
  if (!projectId) {
    return true;
  }

  const result = await getProjectById(projectId);
  return Boolean(result);
}

async function listProjects() {
  return withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        "SELECT id, title, description, status, owner_username, owner_display_name, created_at FROM projects ORDER BY created_at DESC"
      );
      return rows;
    },
    () => listItems("projects")
  );
}

async function getProjectById(projectId) {
  const result = await withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        "SELECT id, title, description, status, owner_username, owner_display_name, created_at FROM projects WHERE id = ? LIMIT 1",
        [projectId]
      );
      return rows[0] || null;
    },
    () => getItem("projects", projectId)
  );

  return result.data;
}

async function createProject(payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "INSERT INTO projects (title, description, status, owner_username, owner_display_name) VALUES (?, ?, ?, ?, ?)",
        [payload.title, payload.description, payload.status, payload.owner_username || null, payload.owner_display_name || null]
      );

      return getProjectById(result.insertId);
    },
    () => createItem("projects", payload)
  );
}

async function deleteUserWorkspaceContent(username) {
  return withFallback(
    async (pool) => {
      const [ownedProjects] = await pool.query("SELECT id FROM projects WHERE owner_username = ?", [username]);
      const ownedProjectIds = ownedProjects.map((item) => Number(item.id)).filter(Boolean);
      const projectPlaceholders = ownedProjectIds.map(() => "?").join(", ");

      let ideasDeleted = 0;
      let errorsDeleted = 0;
      let notesDeleted = 0;

      if (ownedProjectIds.length) {
        const [ideaDelete] = await pool.query(
          `DELETE FROM ideas WHERE owner_username = ? OR project_id IN (${projectPlaceholders})`,
          [username, ...ownedProjectIds]
        );
        ideasDeleted = ideaDelete.affectedRows || 0;

        const [errorDelete] = await pool.query(
          `DELETE FROM errors WHERE owner_username = ? OR project_id IN (${projectPlaceholders})`,
          [username, ...ownedProjectIds]
        );
        errorsDeleted = errorDelete.affectedRows || 0;

        const [noteDelete] = await pool.query(
          `DELETE FROM notes WHERE owner_username = ? OR project_id IN (${projectPlaceholders})`,
          [username, ...ownedProjectIds]
        );
        notesDeleted = noteDelete.affectedRows || 0;
      } else {
        const [ideaDelete] = await pool.query("DELETE FROM ideas WHERE owner_username = ?", [username]);
        ideasDeleted = ideaDelete.affectedRows || 0;

        const [errorDelete] = await pool.query("DELETE FROM errors WHERE owner_username = ?", [username]);
        errorsDeleted = errorDelete.affectedRows || 0;

        const [noteDelete] = await pool.query("DELETE FROM notes WHERE owner_username = ?", [username]);
        notesDeleted = noteDelete.affectedRows || 0;
      }

      const [projectDelete] = await pool.query("DELETE FROM projects WHERE owner_username = ?", [username]);

      return {
        projects: projectDelete.affectedRows || 0,
        ideas: ideasDeleted,
        errors: errorsDeleted,
        notes: notesDeleted
      };
    },
    () => deleteItemsOwnedByUsername(username)
  );
}

async function updateProject(projectId, payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "UPDATE projects SET title = ?, description = ?, status = ? WHERE id = ?",
        [payload.title, payload.description, payload.status, projectId]
      );

      if (!result.affectedRows) {
        return null;
      }

      return getProjectById(projectId);
    },
    () => updateItem("projects", projectId, payload)
  );
}

async function deleteProject(projectId) {
  return withFallback(
    async (pool) => {
      const project = await getProjectById(projectId);

      if (!project) {
        return null;
      }

      await pool.query("DELETE FROM projects WHERE id = ?", [projectId]);
      return project;
    },
    () => deleteItem("projects", projectId)
  );
}

async function listIdeas() {
  return withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        `SELECT ideas.id, ideas.project_id, ideas.title, ideas.description, ideas.category, ideas.priority, ideas.created_at,
                ideas.owner_username, ideas.owner_display_name,
                projects.title AS project_title
         FROM ideas
         LEFT JOIN projects ON projects.id = ideas.project_id
         ORDER BY ideas.created_at DESC`
      );
      return rows;
    },
    async () => {
      const [ideas, projects] = await Promise.all([listItems("ideas"), listItems("projects")]);
      return ideas.map((idea) => ({
        ...idea,
        project_title: projects.find((project) => project.id === idea.project_id)?.title || null
      }));
    }
  );
}

async function getIdeaById(ideaId) {
  const result = await withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        `SELECT ideas.id, ideas.project_id, ideas.title, ideas.description, ideas.category, ideas.priority, ideas.created_at,
                ideas.owner_username, ideas.owner_display_name,
                projects.title AS project_title
         FROM ideas
         LEFT JOIN projects ON projects.id = ideas.project_id
         WHERE ideas.id = ?
         LIMIT 1`,
        [ideaId]
      );
      return rows[0] || null;
    },
    async () => {
      const idea = await getItem("ideas", ideaId);
      if (!idea) {
        return null;
      }

      const project = idea.project_id ? await getItem("projects", idea.project_id) : null;
      return {
        ...idea,
        project_title: project?.title || null
      };
    }
  );

  return result.data;
}

async function createIdea(payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "INSERT INTO ideas (project_id, title, description, category, priority, owner_username, owner_display_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          payload.project_id,
          payload.title,
          payload.description,
          payload.category,
          payload.priority,
          payload.owner_username || null,
          payload.owner_display_name || null
        ]
      );
      return getIdeaById(result.insertId);
    },
    () => createItem("ideas", payload)
  );
}

async function updateIdea(ideaId, payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "UPDATE ideas SET project_id = ?, title = ?, description = ?, category = ?, priority = ? WHERE id = ?",
        [payload.project_id, payload.title, payload.description, payload.category, payload.priority, ideaId]
      );

      if (!result.affectedRows) {
        return null;
      }

      return getIdeaById(ideaId);
    },
    () => updateItem("ideas", ideaId, payload)
  );
}

async function deleteIdea(ideaId) {
  return withFallback(
    async (pool) => {
      const idea = await getIdeaById(ideaId);

      if (!idea) {
        return null;
      }

      await pool.query("DELETE FROM ideas WHERE id = ?", [ideaId]);
      return idea;
    },
    () => deleteItem("ideas", ideaId)
  );
}

async function listErrors() {
  return withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        `SELECT errors.id, errors.project_id, errors.title, errors.description, errors.technology, errors.solution, errors.status, errors.created_at,
                errors.owner_username, errors.owner_display_name,
                projects.title AS project_title
         FROM errors
         LEFT JOIN projects ON projects.id = errors.project_id
         ORDER BY errors.created_at DESC`
      );
      return rows;
    },
    async () => {
      const [items, projects] = await Promise.all([listItems("errors"), listItems("projects")]);
      return items.map((item) => ({
        ...item,
        project_title: projects.find((project) => project.id === item.project_id)?.title || null
      }));
    }
  );
}

async function getErrorById(errorId) {
  const result = await withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        `SELECT errors.id, errors.project_id, errors.title, errors.description, errors.technology, errors.solution, errors.status, errors.created_at,
                errors.owner_username, errors.owner_display_name,
                projects.title AS project_title
         FROM errors
         LEFT JOIN projects ON projects.id = errors.project_id
         WHERE errors.id = ?
         LIMIT 1`,
        [errorId]
      );
      return rows[0] || null;
    },
    async () => {
      const item = await getItem("errors", errorId);
      if (!item) {
        return null;
      }

      const project = item.project_id ? await getItem("projects", item.project_id) : null;
      return {
        ...item,
        project_title: project?.title || null
      };
    }
  );

  return result.data;
}

async function createErrorEntry(payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "INSERT INTO errors (project_id, title, description, technology, solution, status, owner_username, owner_display_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          payload.project_id,
          payload.title,
          payload.description,
          payload.technology,
          payload.solution,
          payload.status,
          payload.owner_username || null,
          payload.owner_display_name || null
        ]
      );
      return getErrorById(result.insertId);
    },
    () => createItem("errors", payload)
  );
}

async function updateErrorEntry(errorId, payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "UPDATE errors SET project_id = ?, title = ?, description = ?, technology = ?, solution = ?, status = ? WHERE id = ?",
        [
          payload.project_id,
          payload.title,
          payload.description,
          payload.technology,
          payload.solution,
          payload.status,
          errorId
        ]
      );

      if (!result.affectedRows) {
        return null;
      }

      return getErrorById(errorId);
    },
    () => updateItem("errors", errorId, payload)
  );
}

async function deleteErrorEntry(errorId) {
  return withFallback(
    async (pool) => {
      const item = await getErrorById(errorId);

      if (!item) {
        return null;
      }

      await pool.query("DELETE FROM errors WHERE id = ?", [errorId]);
      return item;
    },
    () => deleteItem("errors", errorId)
  );
}

async function listNotes() {
  return withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        `SELECT notes.id, notes.project_id, notes.title, notes.content, notes.topic, notes.created_at,
                notes.owner_username, notes.owner_display_name,
                projects.title AS project_title
         FROM notes
         LEFT JOIN projects ON projects.id = notes.project_id
         ORDER BY notes.created_at DESC`
      );
      return rows;
    },
    async () => {
      const [items, projects] = await Promise.all([listItems("notes"), listItems("projects")]);
      return items.map((item) => ({
        ...item,
        project_title: projects.find((project) => project.id === item.project_id)?.title || null
      }));
    }
  );
}

async function getNoteById(noteId) {
  const result = await withFallback(
    async (pool) => {
      const [rows] = await pool.query(
        `SELECT notes.id, notes.project_id, notes.title, notes.content, notes.topic, notes.created_at,
                notes.owner_username, notes.owner_display_name,
                projects.title AS project_title
         FROM notes
         LEFT JOIN projects ON projects.id = notes.project_id
         WHERE notes.id = ?
         LIMIT 1`,
        [noteId]
      );
      return rows[0] || null;
    },
    async () => {
      const item = await getItem("notes", noteId);
      if (!item) {
        return null;
      }

      const project = item.project_id ? await getItem("projects", item.project_id) : null;
      return {
        ...item,
        project_title: project?.title || null
      };
    }
  );

  return result.data;
}

async function createNote(payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "INSERT INTO notes (project_id, title, content, topic, owner_username, owner_display_name) VALUES (?, ?, ?, ?, ?, ?)",
        [payload.project_id, payload.title, payload.content, payload.topic, payload.owner_username || null, payload.owner_display_name || null]
      );
      return getNoteById(result.insertId);
    },
    () => createItem("notes", payload)
  );
}

async function updateNote(noteId, payload) {
  return withFallback(
    async (pool) => {
      const [result] = await pool.query(
        "UPDATE notes SET project_id = ?, title = ?, content = ?, topic = ? WHERE id = ?",
        [payload.project_id, payload.title, payload.content, payload.topic, noteId]
      );

      if (!result.affectedRows) {
        return null;
      }

      return getNoteById(noteId);
    },
    () => updateItem("notes", noteId, payload)
  );
}

async function deleteNote(noteId) {
  return withFallback(
    async (pool) => {
      const item = await getNoteById(noteId);

      if (!item) {
        return null;
      }

      await pool.query("DELETE FROM notes WHERE id = ?", [noteId]);
      return item;
    },
    () => deleteItem("notes", noteId)
  );
}

async function getDashboardSummary() {
  return withFallback(
    async (pool) => {
      const [[projectsCount]] = await pool.query("SELECT COUNT(*) AS total_projects FROM projects");
      const [[ideasCount]] = await pool.query("SELECT COUNT(*) AS total_ideas FROM ideas");
      const [[errorsCount]] = await pool.query(
        "SELECT COUNT(*) AS pending_errors FROM errors WHERE status = 'pending'"
      );
      const [[notesCount]] = await pool.query("SELECT COUNT(*) AS total_notes FROM notes");
      const [[latestProject]] = await pool.query(
        "SELECT id, title, description, status, owner_username, owner_display_name, created_at FROM projects ORDER BY created_at DESC LIMIT 1"
      );
      const [recentProjects] = await pool.query(
        "SELECT id, title, description, status, owner_username, owner_display_name, created_at FROM projects ORDER BY created_at DESC LIMIT 3"
      );
      const [recentIdeas] = await pool.query(
        "SELECT id, title, priority, created_at FROM ideas ORDER BY created_at DESC LIMIT 3"
      );
      const [recentErrors] = await pool.query(
        "SELECT id, title, status, created_at FROM errors ORDER BY created_at DESC LIMIT 3"
      );
      const [recentNotes] = await pool.query(
        "SELECT id, title, topic, created_at FROM notes ORDER BY created_at DESC LIMIT 3"
      );

      return {
        totalProjects: projectsCount.total_projects,
        totalIdeas: ideasCount.total_ideas,
        pendingErrors: errorsCount.pending_errors,
        totalNotes: notesCount.total_notes,
        latestProject: latestProject || null,
        recentActivity: {
          projects: recentProjects,
          ideas: recentIdeas,
          errors: recentErrors,
          notes: recentNotes
        }
      };
    },
    () => buildSummary()
  );
}

module.exports = {
  projectExists,
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  listIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea,
  listErrors,
  getErrorById,
  createErrorEntry,
  updateErrorEntry,
  deleteErrorEntry,
  listNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getDashboardSummary,
  deleteUserWorkspaceContent
};
