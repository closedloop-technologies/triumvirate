# Agent Guide: triumvirate

This repository contains **Triumvirate**, a Node.js/TypeScript CLI that performs code reviews across OpenAI, Claude and Gemini models.

## Key Directories

- `src` – TypeScript source files
- `dist` – Compiled JavaScript output produced by the build step
- `scripts` – Helper scripts used by the project
- `test` – Vitest unit tests
- `assets` – Images used in documentation

Documentation for humans lives in `README.md`. Planned features are described in `ROADMAP.md`.

## Working with the Project

- Requires Node.js 20 or newer
- Install dependencies with `npm install`
- Run tests with `npm test`
- Run linting and type checks with `npm run verify`
- Build the project with `npm run build`

Always run `npm test` and `npm run verify` before committing changes. The CLI can be executed with `npx triumvirate` or the `tri` command once built.
