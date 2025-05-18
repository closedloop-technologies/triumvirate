# Triumvirate

![Triumvirate Logo](https://raw.githubusercontent.com/closedloop-technologies/triumvirate/refs/heads/main/assets/triumvirate-banner.png)

Triumvirate is a Node.js CLI and GitHub Action that runs code reviews across multiple AI models (OpenAI, Claude and Gemini) and provides a single report with consolidated findings.

## Features

- Multi-model analysis for comprehensive feedback
- Cross-model agreement detection
- Specialized review modes (security, performance, architecture, docs)
- Generates actionable tasks from review results
- Works locally or in CI workflows

## Installation

```bash
npm install -g @justbuild/triumvirate
# or use directly
npx @justbuild/triumvirate
```

## Quick Start

1. Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` to include your OpenAI, Anthropic and Google API keys.

2. Run a review:

```bash
tri review
```

The results will be saved in `.justbuild/review.json` and `.justbuild/review.md`.

## Command Overview

```
tri <command>
```

- `review` – run code reviews across selected models
- `summarize` – create a summary from raw review output
- `plan` – break a summary into tasks with dependencies
- `next` – display the next available task

Run `tri --help` to see all available options.

## GitHub Action

Add Triumvirate to your workflow:

```yaml
- uses: actions/checkout@v3
- uses: actions/setup-node@v3
  with:
    node-version: '20'
- run: npm install
- run: |
    export OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
    export ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
    export GOOGLE_API_KEY=${{ secrets.GOOGLE_API_KEY }}
    npx triumvirate --diff --output review.json --fail-on-error
- uses: actions/upload-artifact@v3
  with:
    name: triumvirate-results
    path: review.json
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and improvements.

## License

MIT
