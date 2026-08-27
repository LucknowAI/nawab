# Contributing to the backend

See the [repo-wide CONTRIBUTING.md](../CONTRIBUTING.md) for branching, PRs, and CI.

## Setup

Follow [README.md](README.md#setup) to get a local instance running before making changes.

## Code style

- Python 3.12, type hints on new functions.
- No enforced formatter yet — match the surrounding file's style (import grouping, docstring style, naming).
- `ruff check .` runs in CI as an advisory pass; fixing warnings it raises in files you touch is welcome but not required.

## Tests

```bash
pytest
```

- Tests that hit real external APIs are marked `@pytest.mark.network` and excluded by default (see [pytest.ini](pytest.ini)); CI never runs them, since they'd depend on network access and third-party quotas.
- Add tests for new logic under `tests/`, mirroring the module path being tested (e.g. `src/utils/context_budget.py` → `tests/test_context_budget.py`).
- Bug fixes should come with a regression test that fails before the fix and passes after.

## Environment variables

Copy `.env.sample` to `.env` and fill in the values documented in the README. Never commit real secrets — `.env` is gitignored.
