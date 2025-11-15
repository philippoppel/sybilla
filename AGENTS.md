# Repository Guidelines

## Project Structure & Module Organization
Runtime logic lives in `server.js`, an Express server securing content updates and optional Git deploys. API route handlers reside in `api/`; editable site data (`content.json`) and admin UI files (`admin.html`, `admin.js`) stay at the project root. Build scripts copy static assets into `public/`, including new `uploads/` images committed via the admin UI. Automated test harnesses live in `tests/`, complemented by the quick regression runner `test-cms.js`.

## Build, Test, and Development Commands
Run `npm install` once for Express, Puppeteer, and the Mocha toolchain. Use `npm run dev` for a reloadable local server via Nodemon, or `npm start`/`PORT=4000 npm start` for production parity. `npm run build` copies deployable artifacts into `public/`; `npm run vercel-build` produces a clean output for Vercel. Tests: `npm test` executes the CMS sanity suite, `npm run test:full` chains the API and edge runners, and `npm run test:ui` launches Puppeteer mobile checks (requires Chrome dependencies).

## Coding Style & Naming Conventions
Stick to CommonJS modules with `require`/`module.exports`. Maintain 4-space indentation, trailing semicolons, and descriptive camelCase identifiers (`rateLimit`, `runTests`). JSON and static assets stay kebab- or snake-cased to mirror existing patterns. Favor small utility helpers over sprawling route handlers; place shared logic in `api/` or helper modules beside the caller.

## Testing Guidelines
Tests assume the app binds to port 3000 and will spawn the server during each run—stop other services first. Follow the naming pattern `tests/<area>-tests.js`, exporting classes with a `runTests()` method that pushes structured results. When adding UI flows, extend `tests/ui-tests.js` with self-contained Puppeteer steps and keep fixtures lightweight so `content.json` stays clean (the harness backs it up automatically). Always run `npm run test:full` before submitting cross-cutting changes.

## Commit & Pull Request Guidelines
Commits in this repo are short, imperative sentences ("Improve auth error logging") and occasionally include emoji for emphasis. Group related changes together and note the user-facing effect. Pull requests should summarize the change, call out affected endpoints or pages, list the commands run (e.g., `npm run test:full`), and include screenshots for UI tweaks or admin workflow updates. Reference linked issues when available.

## Security & Configuration Notes
Set `ADMIN_PASS`, `SECRET_KEY`, and `ADMIN_USER` in your environment before deploying; production boot will fail without a strong secret. Leave `SECRET_KEY` out of commits and rotate when distributing builds. Enable `GIT_ENABLED=true` only when the host has push credentials configured, and prefer `.env` files (excluded from commits) or Vercel project settings for secrets.
