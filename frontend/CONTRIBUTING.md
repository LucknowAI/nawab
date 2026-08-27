# Contributing to the frontend

See the [repo-wide CONTRIBUTING.md](../CONTRIBUTING.md) for branching, PRs, and CI.

## Setup

Follow [README.md](README.md#setup) to get a local instance running before making
changes. You need the [backend](../backend) running too — most of the UI is inert
without it.

## Code style

- TypeScript, React 19, Next.js App Router. Type new props and exported functions.
- No enforced formatter — match the surrounding file.
- **Styling: use the tokens.** Colours live as CSS custom properties in [app/globals.css](app/globals.css) (`--nawab-gold`, `--nawab-ink`, `--city-color`, …) and are overridden per city via `[data-city]`. Never hardcode a hex that duplicates a token — that's how the palette drifts out of sync.
- **Reach for `app/components/ui/` before writing new markup.** If you find yourself copying a button, input, card, or skeleton, extract it there instead.
- Tailwind is installed but barely used; don't introduce it as a third styling system alongside the existing CSS and inline styles.

## Tests

```bash
npm test
```

- Vitest + react-testing-library, jsdom environment ([vitest.config.mts](vitest.config.mts)).
- Put tests in a `__tests__/` directory next to the code under test (e.g. `app/context/AuthContext.tsx` → `app/context/__tests__/AuthContext.test.tsx`).
- Bug fixes should come with a regression test that fails before the fix and passes after.

## Linting

`npm run lint` runs the full ESLint config. CI blocks on everything **except**
`react-hooks/set-state-in-effect`, which has pre-existing hits in `app/page.tsx` and
`app/components/NawabChat.tsx` that need real effect refactors. Don't add new ones,
and drop the exemption in `../.github/workflows/ci.yml` once those are cleaned up.

## Environment variables

Copy `.env.example` to `.env` and fill in the values documented in the README.
`NEXT_PUBLIC_*` vars are inlined at build time, so changing one requires a rebuild —
and in Docker, passing it as a `--build-arg`. Never commit real secrets; `.env` is
gitignored.

The backend base URL has exactly one definition, [app/lib/backend.ts](app/lib/backend.ts).
Import `BACKEND` from there rather than reading `process.env` directly.
