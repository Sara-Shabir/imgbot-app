// Vercel deploys everything under /api as its own serverless function.
// This file turns the Probot app into a plain (req, res) handler so it can
// run without a persistent server.
const { createNodeMiddleware, createProbot } = require("probot");
const app = require("../../../src/index.js");

const probot = createProbot();

module.exports = createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});
