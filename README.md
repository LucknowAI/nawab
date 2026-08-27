# Nawab AI

Nawab AI is a city-scoped conversational assistant — currently focused on
Lucknow — that integrates multiple APIs and LLMs (Google Maps, News API,
YouTube, Lucknow Metro fares, and more) behind a Gemini-based agent, with a
chat UI on top.

This is a monorepo with two independently deployable apps:

| Path | What it is |
|---|---|
| [`backend/`](backend/) | FastAPI + PostgreSQL + Redis service. Google Sign-In / OTP auth, streaming chat (SSE + WebSocket), the agent and its tools. |
| [`frontend/`](frontend/) | Next.js chat UI. Talks to the backend over REST + WebSocket. |

Each has its own setup, run, and test instructions in its README — start
there for local development:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, PRs, and CI, plus
[backend/CONTRIBUTING.md](backend/CONTRIBUTING.md) and
[frontend/CONTRIBUTING.md](frontend/CONTRIBUTING.md) for code style and test
conventions specific to each app.

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md) — how to report a vulnerability.

## License

[MIT](LICENSE)
