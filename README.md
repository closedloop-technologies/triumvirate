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

## Advanced CLI Usage

Triumvirate integrates [Repomix](https://github.com/yamadashy/repomix) for codebase packaging and provides many configuration options:

### Core Options

```bash
--models, -m         Comma-separated model list (openai,claude,gemini)
--exclude, -e        Comma-separated list of patterns to exclude
--diff, -d           Only review files changed in the current git diff
--output, -o         Path to write the review output JSON
--fail-on-error, -f  Exit with non-zero code if any model fails
--summary-only, -s   Only include summary in results
--token-limit, -l    Maximum number of tokens to send to the model
```

### Review Type Options

Triumvirate can perform specialized reviews by setting the review type:

```bash
--review-type, -r    Type of review to perform
```

Available review types:

- `general` - Overall code quality (default)
- `security` - Security vulnerabilities and best practices
- `performance` - Performance optimization opportunities
- `architecture` - System design and component organization
- `docs` - Documentation quality and completeness

### Repomix Integration

Triumvirate passes through many Repomix options for fine-grained control:

```bash
--include            Comma-separated list of patterns to include
--ignore-patterns    Comma-separated list of patterns to ignore
--style              Output style (xml, markdown, plain)
--compress           Perform code compression to reduce token count
--remove-comments    Remove comments from source files
--remove-empty-lines Remove empty lines from source files
--show-line-numbers  Add line numbers to each line in the output
--header-text        Text to include in file header
--instruction-file-path Path to custom instructions file
--top-files-len      Number of top files to include in summary
--token-count-encoding Token counting method (e.g., o200k_base)
```

## Examples

Review only changed files using OpenAI:

```bash
npx triumvirate --models openai --diff
```

Perform a security review:

```bash
npx triumvirate --review-type security --output security-review.json
```

Focus on specific files with compression:

```bash
npx triumvirate --include "src/**/*.js,src/**/*.ts" --compress
```

## GitHub Actions

See `.github/workflows/triumvirate.yml`.

## Badge

Use [Shields.io](https://shields.io) to create a dynamic badge from your review output or CI status.

## Development Workflow

### Git Hooks

This project uses Git hooks to ensure code quality:

- **Pre-commit Hook**: Runs fast checks on changed files only
  - Linting (ESLint) on changed files only
  - Format checking (Prettier) on changed files only
  - Type checking on changed TypeScript files only

- **Pre-push Hook**: Runs the full build process
  - Complete type checking
  - Linting all files
  - Formatting all files
  - Building the project

This approach optimizes the developer experience by keeping commit times fast while still ensuring code quality before pushing to the repository.
