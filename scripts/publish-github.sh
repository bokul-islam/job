#!/usr/bin/env bash
# Publish this project to GitHub (account: boku-islam).
# Prerequisites: one of the two auth methods below.
set -euo pipefail

REPO_NAME="${1:-talentbridge}"
ACCOUNT="boku-islam"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "Using GitHub CLI..."
  gh repo create "${ACCOUNT}/${REPO_NAME}" --private --source=. --remote=origin --push
  echo "Done: https://github.com/${ACCOUNT}/${REPO_NAME}"
  exit 0
fi

if [ -n "${GITHUB_TOKEN:-}" ] || [ -n "${GH_TOKEN:-}" ]; then
  TOKEN="${GITHUB_TOKEN:-${GH_TOKEN}}"
  echo "Creating repo via GitHub API..."
  curl -sf -X POST -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"${REPO_NAME}\",\"private\":true,\"description\":\"Full-stack job marketplace — Next.js 16, Drizzle ORM, PostgreSQL\"}" > /dev/null
  git remote add origin "https://${TOKEN}@github.com/${ACCOUNT}/${REPO_NAME}.git" 2>/dev/null || git remote set-url origin "https://${TOKEN}@github.com/${ACCOUNT}/${REPO_NAME}.git"
  git push -u origin main
  git remote set-url origin "https://github.com/${ACCOUNT}/${REPO_NAME}.git"  # strip token from remote URL
  echo "Done: https://github.com/${ACCOUNT}/${REPO_NAME}"
  exit 0
fi

cat <<'MSG'
No GitHub auth found. Do ONE of these, then re-run this script:

  A) GitHub CLI:  https://cli.github.com  →  gh auth login
  B) Personal access token:  https://github.com/settings/tokens (scope: repo)
     then run:  GITHUB_TOKEN=ghp_xxx bash scripts/publish-github.sh

Manual alternative:
  1. Create the repo: https://github.com/new  (name: talentbridge, private)
  2. git remote add origin git@github.com:boku-islam/talentbridge.git
  3. git push -u origin main
MSG
exit 1
