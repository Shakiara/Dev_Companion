const fs = require("fs/promises");
const path = require("path");

const storePath = path.join(__dirname, "fallback-db.json");

async function readStore() {
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw);
}

async function writeStore(data) {
  await fs.writeFile(storePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function getNextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function sortByCreatedAt(items) {
  return [...items].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

async function listItems(tableName) {
  const store = await readStore();
  return sortByCreatedAt(store[tableName] || []);
}

async function getItem(tableName, id) {
  const store = await readStore();
  return (store[tableName] || []).find((item) => Number(item.id) === Number(id)) || null;
}

async function createItem(tableName, payload) {
  const store = await readStore();
  const items = store[tableName] || [];
  const newItem = {
    id: getNextId(items),
    ...payload,
    created_at: new Date().toISOString()
  };

  items.push(newItem);
  store[tableName] = items;
  await writeStore(store);
  return newItem;
}

async function updateItem(tableName, id, payload) {
  const store = await readStore();
  const items = store[tableName] || [];
  const index = items.findIndex((item) => Number(item.id) === Number(id));

  if (index === -1) {
    return null;
  }

  items[index] = {
    ...items[index],
    ...payload
  };

  store[tableName] = items;
  await writeStore(store);
  return items[index];
}

async function deleteItem(tableName, id) {
  const store = await readStore();
  const items = store[tableName] || [];
  const index = items.findIndex((item) => Number(item.id) === Number(id));

  if (index === -1) {
    return null;
  }

  const [deletedItem] = items.splice(index, 1);
  store[tableName] = items;

  if (tableName === "projects") {
    ["ideas", "errors", "notes"].forEach((relatedTable) => {
      store[relatedTable] = (store[relatedTable] || []).map((item) => {
        if (Number(item.project_id) === Number(id)) {
          return { ...item, project_id: null };
        }

        return item;
      });
    });
  }

  await writeStore(store);
  return deletedItem;
}

async function deleteItemsOwnedByUsername(username) {
  const store = await readStore();
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const deletedProjectIds = new Set();
  const deletedCounts = {
    projects: 0,
    ideas: 0,
    errors: 0,
    notes: 0
  };

  store.projects = (store.projects || []).filter((item) => {
    const isOwned = String(item.owner_username || "").toLowerCase() === normalizedUsername;

    if (isOwned) {
      deletedProjectIds.add(Number(item.id));
      deletedCounts.projects += 1;
      return false;
    }

    return true;
  });

  ["ideas", "errors", "notes"].forEach((tableName) => {
    store[tableName] = (store[tableName] || []).filter((item) => {
      const isOwned = String(item.owner_username || "").toLowerCase() === normalizedUsername;
      const linkedToDeletedProject = deletedProjectIds.has(Number(item.project_id));

      if (isOwned || linkedToDeletedProject) {
        deletedCounts[tableName] += 1;
        return false;
      }

      return true;
    });
  });

  await writeStore(store);
  return deletedCounts;
}

async function buildSummary() {
  const store = await readStore();
  const projects = sortByCreatedAt(store.projects || []);
  const ideas = sortByCreatedAt(store.ideas || []);
  const errors = sortByCreatedAt(store.errors || []);
  const notes = sortByCreatedAt(store.notes || []);

  return {
    totalProjects: projects.length,
    totalIdeas: ideas.length,
    pendingErrors: errors.filter((item) => item.status === "pending").length,
    totalNotes: notes.length,
    latestProject: projects[0] || null,
    recentActivity: {
      projects: projects.slice(0, 3),
      ideas: ideas.slice(0, 3),
      errors: errors.slice(0, 3),
      notes: notes.slice(0, 3)
    },
    source: "file"
  };
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  deleteItemsOwnedByUsername,
  buildSummary
};
