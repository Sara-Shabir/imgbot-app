<div align="center">

# 🤖 Imgbot

**A friendly robot that optimizes your images and saves you time.**

Imgbot scans your repositories, compresses images losslessly, and opens a pull request with the savings — automatically.



![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)




![Probot](https://img.shields.io/badge/Built%20with-Probot-000000?logo=github)




![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)




![License](https://img.shields.io/badge/License-MIT-blue.svg)



</div>

---

## ✨ What it does

- 🔍 Scans your repository for images on install and on every push
- 🗜️ Re-compresses PNG, JPEG, WebP, AVIF, and GIF files — lossless or visually lossless
- 🔀 Opens a single pull request with a before/after size table
- 🚫 Never touches files that are already optimized — no noisy PRs
- ⚡ Runs as a serverless function, so there's nothing to host or maintain

## 📸 How it works

1. **Install** the app on a repository
2. Imgbot walks the repo tree and finds every image file
3. Each image is re-encoded with format-appropriate compression settings
4. If there are real savings, Imgbot opens **one pull request** with a clean summary:

   | File | Before | After | Saved |
   |---|---|---|---|
   | `assets/banner.png` | 842 KB | 301 KB | -64% |
   | `docs/screenshot.jpg` | 1.2 MB | 480 KB | -60% |

5. Merge whenever you like — Imgbot picks up new images on the next push

## 🛠️ Compression strategy

| Format | Approach |
|---|---|
| PNG | Max compression + palette reduction (lossless) |
| JPEG | mozjpeg re-encode at quality 82 (visually lossless) |
| WebP | Lossless re-encode |
| AVIF | Lossless re-encode |
| GIF | Optimized frame compression |

## 🚀 Tech stack

- **[Probot](https://probot.github.io)** — GitHub App event handling
- **[Sharp](https://sharp.pixelplumbing.com)** — image compression engine
- **[Octokit](https://github.com/octokit)** — GitHub REST API client
- **[Vercel](https://vercel.com)** — serverless hosting

## 📦 Project structure
