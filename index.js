const { createNodeMiddleware, createProbot } = require("probot");

const probot = createProbot();

const appFn = (app) => {
  app.log.info("Imgbot is running!");
  app.on(["push", "pull_request.opened"], async (context) => {
    app.log.info("Webhook event received!");
  });
};

module.exports = async (req, res) => {
  if (req.url === "/" || req.url === "") {
    return res.status(200).send("Imgbot service is active!");
  }
  const middleware = await createNodeMiddleware(appFn, { probot });
  return middleware(req, res);
};
