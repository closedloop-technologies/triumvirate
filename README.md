# Triumvirate Review

![Triumvirate](https://img.shields.io/badge/Triumvirate-Passed-brightgreen)

A CLI and GitHub Action to run codebase reviews through multiple LLMs like OpenAI, Claude, and Gemini.

## Install

```bash
npm install
```

## Environment Variables

Copy and set your secrets:

```bash
cp .env.example .env
```

## CLI Usage

```bash
npx triumvirate \
  --models openai,claude,gemini \
  --diff \
  --output triumvirate.json \
  --fail-on-error \
  --summary-only
```

## GitHub Actions

See `.github/workflows/triumvirate.yml`.

## Badge

Use [Shields.io](https://shields.io) to create a dynamic badge from your review output or CI status.
