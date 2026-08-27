# Contributing to Nawab AI

This is a monorepo: [`backend/`](backend/) (FastAPI) and
[`frontend/`](frontend/) (Next.js) are independently deployable apps that
share one repo, one issue tracker, and one PR flow.

For code style, tests, and environment setup specific to each app, see:

- [backend/CONTRIBUTING.md](backend/CONTRIBUTING.md)
- [frontend/CONTRIBUTING.md](frontend/CONTRIBUTING.md)

## Branching & PRs

- `main` is production; `dev` is the integration branch, auto-deployed to the
  VPS staging environment on every push (see
  [.github/workflows/deploy-dev.yml](.github/workflows/deploy-dev.yml)).
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
