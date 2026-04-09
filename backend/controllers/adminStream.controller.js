const {
  addAdminStreamClient,
  removeAdminStreamClient
} = require("../utils/adminRealtime");

function streamAdminActivity(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  addAdminStreamClient(res);

  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeAdminStreamClient(res);
    res.end();
  });
}

module.exports = { streamAdminActivity };
