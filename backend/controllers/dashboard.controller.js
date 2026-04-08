const { getDashboardSummary } = require("../services/dataService");

async function getSummary(_req, res) {
  const result = await getDashboardSummary();
  return res.json(result);
}

module.exports = { getSummary };
