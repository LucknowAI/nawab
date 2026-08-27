/**
 * Single source of truth for the backend base URL.
 *
 * Previously this literal was duplicated across 16 call sites with three
 * different fallbacks (`:8080`, `:8000`, and `:9000` in the docs). `:9000` is
 * the correct local-dev default — it matches the backend's README and
 * `.env.example`. `:8080` is the backend's *Docker* port, which is only
 * reachable locally if you happen to be running the container.
 */
export const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:9000";
