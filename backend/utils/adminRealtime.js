const clients = new Set();

function formatSseMessage(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function addAdminStreamClient(res) {
  clients.add(res);
  res.write(formatSseMessage("connected", {
    type: "connected",
    timestamp: new Date().toISOString()
  }));
}

function removeAdminStreamClient(res) {
  clients.delete(res);
}

function broadcastAdminRefresh(reason) {
  const message = formatSseMessage("admin-refresh", {
    type: "admin-refresh",
    reason,
    timestamp: new Date().toISOString()
  });

  for (const client of clients) {
    client.write(message);
  }
}

module.exports = {
  addAdminStreamClient,
  removeAdminStreamClient,
  broadcastAdminRefresh
};
