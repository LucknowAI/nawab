# Contributing to Nawab AI

This is a monorepo: [`backend/`](backend/) (FastAPI) and
[`frontend/`](frontend/) (Next.js) are independently deployable apps that
share one repo, one issue tracker, and one PR flow.

For code style, tests, and environment setup specific to each app, see:

- [backend/CONTRIBUTING.md](backend/CONTRIBUTING.md)
- [frontend/CONTRIBUTING.md](frontend/CONTRIBUTING.md)

## Branching & PRs

- `main` is production; `dev` is the integration branch. Pushing to `dev` does
  **not** deploy anything. Deploys are started by hand (see
  [Deploying the backend](#deploying-the-backend)).
- Branch off `dev` for new work: `git checkout -b <type>/<short-description>`
  (e.g. `fix/token-limit-guard`). Prefix isn't required to indicate which app
  it touches — CI only runs the jobs for the paths you actually changed.
- Open PRs against `dev`. Use the PR template checklist.
- `dev` gets merged into `main` to promote a build to production (backend via
  GCP Cloud Build → Cloud Run on push to `main`; frontend similarly via Cloud
  Build).
- Both `main` and `dev` are protected: no direct pushes, no force-push, no
  deletion. Merges are squash-only, so PR titles become the commit message —
  make them count.
- Keep commits and PRs scoped to one app where possible; a PR that touches
  both `backend/` and `frontend/` should have a reason to (e.g. an API
  contract change on both sides of it).

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every PR and on
pushes to `main` / `dev`, and only runs the backend or frontend jobs (lint →
test → build) for the app(s) a change actually touches.

## Reporting issues

Use the issue templates (bug report / feature request) so triage has what it
needs: repro steps, expected vs. actual behavior, and which app is affected.

Security vulnerabilities should **not** be reported as public issues — see
[SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Deploying the backend

Deploys are manual. Nothing goes live until someone clicks a button.

1. Open the repo on GitHub and go to **Actions**.
2. Pick **Deploy backend (manual)** on the left.
3. Click **Run workflow**.
4. Type the branch or tag to deploy (default is `main`) and click the green
   **Run workflow** button.
5. Watch the run. Green means the new version is live. Red means the deploy
   failed.

What the workflow does:

1. Connects to the server over SSH.
2. Downloads the code for the branch or tag you picked.
3. Checks that `backend/.env` exists on the server and has the required
   settings.
4. Builds and starts the backend with Docker.
5. Checks `/api/v1/health/` for up to 30 seconds.

If the health check fails, the workflow puts the **previous version** back
(rebuilds it and starts it) and the run turns red. On the very first deploy
there is no previous version, so the broken container is stopped instead.

Good to know:

- Rolling back only restores the code. Database changes that already ran are
  **not** undone.
- `backend/.env` lives on the server only and is never in git. If it is
  missing, the deploy stops with a clear message. Create it first.
- The workflow needs these repo secrets: `DEPLOY_HOST`, `DEPLOY_USER`,
  `DEPLOY_SSH_KEY`.
- Only the backend is covered by this workflow.
