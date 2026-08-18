# Imgbot 🤖

A friendly GitHub App that scans a repository for images, re-compresses them
(lossless or visually-lossless, depending on format), and opens a pull
request with the savings — just like the original Imgbot.

- Installs on any repo (or your whole account/org)
- On install: full scan of the default branch
- On every push to the default branch: rescans for new/changed images
- Opens one PR at a time with a before/after size table; won't spam duplicate PRs
- Nothing ever leaves GitHub — no third-party server stores your images; the
  app itself just needs somewhere to run (see Deploy, below)

## How it decides what to optimize

| Format | Strategy |
|---|---|
| PNG | re-encoded with max compression + palette reduction (lossless) |
| JPEG | re-encoded with mozjpeg at quality 82 (visually lossless) |
| WebP | re-encoded lossless |
| AVIF | re-encoded lossless |
| GIF | re-encoded with optimized frame compression |

A file is only included in the PR if the optimized version is at least 1%
smaller than the original — nothing is ever made *worse*.

## 1. Create the GitHub App

Easiest path is the manifest flow, which pre-fills everything from `app.yml`:

1. Go to `https://github.com/settings/apps/new` (or your org's equivalent).
2. You can either fill the form by hand, or use `app.yml` in this repo with
   [Probot's manifest flow](https://probot.github.io/docs/development/#manifest)
   to create the app in one click.
3. Required permissions:
   - **Contents**: Read & write
   - **Pull requests**: Read & write
   - **Metadata**: Read-only
4. Subscribe to events: `push`, `installation`, `installation_repositories`.
5. After creation, download the **private key** (`.pem`) and note the **App ID**.

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `APP_ID` — from the app's settings page
- `PRIVATE_KEY_PATH` — path to the downloaded `.pem` file
- `WEBHOOK_SECRET` — set this to the same value on both the GitHub App page and `.env`

## 3. Install dependencies & run locally

```bash
npm install
npm run dev
```

For local webhook delivery during development, use a relay like
[smee.io](https://smee.io) and point your app's **Webhook URL** at the smee
channel — Probot will forward it to `localhost:3000` automatically when you
set `WEBHOOK_PROXY_URL` in `.env`.

## 4. Deploy

### Option A — Vercel (serverless)

This repo already includes the Vercel entry point at
`api/github/webhooks/index.js`, so no extra adaptation is needed.

1. Push this folder to its own GitHub repo.
2. On [vercel.com](https://vercel.com), **Add New → Project**, import that repo.
   Framework preset: "Other". No build command needed — Vercel auto-detects
   the `api/` folder as a serverless function.
3. In **Project Settings → Environment Variables**, add:
   - `APP_ID` — from the GitHub App settings page
   - `WEBHOOK_SECRET` — same value as configured on the GitHub App
   - `PRIVATE_KEY` — paste the **full contents** of the downloaded `.pem` file
     (Vercel's env var editor supports multi-line values; don't use
     `PRIVATE_KEY_PATH` here, Vercel's filesystem is read-only/ephemeral so a
     `.pem` file on disk won't persist)
4. Deploy. Vercel gives you a URL like `https://imgbot-app.vercel.app`.
5. Go back to the GitHub App settings and set **Webhook URL** to:
   ```
   https://imgbot-app.vercel.app/api/github/webhooks
   ```
6. Save. Every push to your GitHub repo auto-redeploys via Vercel's GitHub integration.

### Option B — Render / Railway / Fly.io / a VPS (long-running server)

1. Push this folder to its own GitHub repo.
2. On your host: set the build command to `npm install` and start command to `npm start`.
3. Add the same environment variables (`APP_ID`, `WEBHOOK_SECRET`, and either
   `PRIVATE_KEY_PATH` pointing at an uploaded file, or `PRIVATE_KEY` with the
   key contents directly — Probot supports both).
4. Once deployed, update the GitHub App's **Webhook URL** to
   `https://<your-host>/api/github/webhooks`.

## 5. Install it on a repo

From the app's public page (`https://github.com/apps/<your-app-name>`),
click **Install**, choose a repository, and Imgbot will run its first scan
within a few seconds. Check the **Pull requests** tab for the result.

## Project structure

```
imgbot-app/
├── app.yml                          GitHub App manifest (for one-click setup)
├── api/github/webhooks/index.js     Vercel serverless entry point
├── vercel.json                      Vercel function config
├── src/
│   ├── index.js                      Event wiring (install + push)
│   ├── repoScan.js                    Walks the repo tree, builds the PR
│   └── optimizeImage.js               Per-file compression logic (sharp)
├── package.json
└── .env.example
```

## Notes & limits (Vercel specifically)

- `sharp` ships a native binary; `npm install` on Vercel's build machine pulls
  the correct Linux binary automatically, so no extra config is needed.
- Vercel's default function timeout is short on the Hobby plan — `vercel.json`
  raises it to 30s, which comfortably covers small/medium repos. Very large
  repos (hundreds of images on first install scan) may need a Pro plan or
  Option B (long-running server) instead, since a single scan can't span
  multiple invocations.

## Notes & limits

- Files over 15 MB are skipped to keep scans fast.
- `node_modules/`, `.git/`, `vendor/`, `dist/`, `build/` are ignored.
- Only one Imgbot PR is open at a time per repo — merge or close it to
  trigger a fresh scan on the next push.
- Very large repos with thousands of images will take longer on the first
  install scan since each image is fetched individually via the GitHub API.
