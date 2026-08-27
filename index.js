const { createNodeMiddleware, createProbot } = require("probot");
const sharp = require("sharp");

const probot = createProbot();

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tiff",
  ".avif"
];

function isImage(filePath) {
  return IMAGE_EXTENSIONS.some((ext) =>
    filePath.toLowerCase().endsWith(ext)
  );
}

async function optimizeImage(buffer, extension) {
  let image = sharp(buffer);

  switch (extension.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return await image
        .jpeg({
          quality: 80,
          mozjpeg: true
        })
        .toBuffer();

    case ".png":
      return await image
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .toBuffer();

    case ".webp":
      return await image
        .webp({
          quality: 80
        })
        .toBuffer();

    case ".avif":
      return await image
        .avif({
          quality: 60
        })
        .toBuffer();

    case ".tiff":
      return await image
        .tiff({
          quality: 80
        })
        .toBuffer();

    default:
      return buffer;
  }
}

const appFn = (app) => {
  app.log.info("🚀 Imgbot is running!");

  app.on("push", async (context) => {
    const payload = context.payload;

    // Only process pushes to main branch
    if (payload.ref !== "refs/heads/main") {
      app.log.info("Push is not on main branch. Skipping.");
      return;
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const baseBranch = payload.repository.default_branch || "main";
    const commitSha = payload.after;

    app.log.info(`Checking images in ${owner}/${repo}...`);

    try {
      const commitResponse = await context.octokit.repos.getCommit({
        owner,
        repo,
        ref: commitSha
      });

      const files = commitResponse.data.files || [];

      const imageFiles = files.filter(
        (file) =>
          ["added", "modified"].includes(file.status) &&
          isImage(file.filename)
      );

      if (imageFiles.length === 0) {
        app.log.info("No new or modified images found.");
        return;
      }

      app.log.info(
        `Found ${imageFiles.length} image(s) to optimize.`
      );

      // Unique branch for this optimization
      const branchName = `imgbot/optimize-${commitSha.slice(0, 7)}`;

      // Get base branch
      const baseRef = await context.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`
      });

      const baseSha = baseRef.data.object.sha;

      // Create optimization branch
      try {
        await context.octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseSha
        });
      } catch (error) {
        // Branch may already exist
        if (error.status !== 422) {
          throw error;
        }
      }

      let optimizedCount = 0;
      let totalSaved = 0;

      for (const file of imageFiles) {
        try {
          app.log.info(`Optimizing: ${file.filename}`);

          const contentResponse =
            await context.octokit.repos.getContent({
              owner,
              repo,
              path: file.filename,
              ref: commitSha
            });

          if (
            Array.isArray(contentResponse.data) ||
            !contentResponse.data.content
          ) {
            continue;
          }

          const originalBuffer = Buffer.from(
            contentResponse.data.content,
            "base64"
          );

          const extension =
            "." + file.filename.split(".").pop();

          const optimizedBuffer = await optimizeImage(
            originalBuffer,
            extension
          );

          const originalSize = originalBuffer.length;
          const optimizedSize = optimizedBuffer.length;

          // Don't replace the image if optimization makes it larger
          if (optimizedSize >= originalSize) {
            app.log.info(
              `Skipping ${file.filename}: optimized file is not smaller.`
            );
            continue;
          }

          const saved = originalSize - optimizedSize;
          totalSaved += saved;

          // Get current file SHA from optimization branch
          const branchFile =
            await context.octokit.repos.getContent({
              owner,
              repo,
              path: file.filename,
              ref: branchName
            });

          await context.octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: file.filename,
            message: `🤖 Optimize ${file.filename}`,
            content: optimizedBuffer.toString("base64"),
            branch: branchName,
            sha: branchFile.data.sha
          });

          optimizedCount++;

          app.log.info(
            `Optimized ${file.filename}: ${originalSize} → ${optimizedSize} bytes`
          );
        } catch (error) {
          app.log.error(
            `Failed to optimize ${file.filename}: ${error.message}`
          );
        }
      }

      if (optimizedCount === 0) {
        app.log.info("No images became smaller. No PR created.");
        return;
      }

      const savedKB = (totalSaved / 1024).toFixed(2);

      // Check whether an identical PR already exists
      const existingPRs =
        await context.octokit.pulls.list({
          owner,
          repo,
          head: `${owner}:${branchName}`,
          base: baseBranch,
          state: "open"
        });

      if (existingPRs.data.length > 0) {
        app.log.info("Optimization PR already exists.");
        return;
      }

      // Create Pull Request
      const pr = await context.octokit.pulls.create({
        owner,
        repo,
        title: "🤖 Imgbot: Optimize images",
        head: branchName,
        base: baseBranch,
        body: `## 🤖 Imgbot Image Optimization

Imgbot automatically optimized **${optimizedCount} image(s)**.

### Results
- 🖼️ Images optimized: **${optimizedCount}**
- 💾 Space saved: **${savedKB} KB**

The optimized images are included in this pull request.

_This PR was automatically created by Imgbot._
`
      });

      app.log.info(`Optimization PR created: #${pr.data.number}`);
    } catch (error) {
      app.log.error(`Imgbot error: ${error.stack || error.message}`);
    }
  });
};

module.exports = async (req, res) => {
  if (req.url === "/" || req.url === "") {
    return res.status(200).send("Imgbot service is active! 🤖");
  }

  const middleware = await createNodeMiddleware(appFn, {
    probot
  });

  return middleware(req, res);
};
