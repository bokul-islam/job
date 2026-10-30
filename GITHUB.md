# Publishing to GitHub (boku-islam)

This repo is ready to push. Three options:

## Option A — Personal access token (works anywhere)
1. Create a token at https://github.com/settings/tokens (or fine-grained tokens) with the **repo** scope.
2. Run:
   ```bash
   GITHUB_TOKEN=ghp_yourtoken bash scripts/publish-github.sh talentbridge
   ```

## Option B — GitHub CLI
```bash
gh auth login
bash scripts/publish-github.sh talentbridge
```

## Option C — fully manual
1. https://github.com/new → name: `talentbridge` → Private → do NOT add README/gitignore (already in repo)
2. ```bash
   git remote add origin git@github.com:boku-islam/talentbridge.git
   git push -u origin main
   ```

### After pushing
- Add secrets for CI/deploys in **Settings → Secrets and variables**: `DATABASE_URL`, `UPLOAD_SIGNING_SECRET`, `RESEND_API_KEY`, `R2_*`, `SSLCZ_*`, `BKASH_*` (see `.env.example`).
- Protect `main` (require build + `npx vitest run` checks).
- Re-running `npx tsx src/db/seed.ts` resets demo passwords — never commit real credentials.
