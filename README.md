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

Triumvirate provides a set of subcommands to support a complete code review workflow:

```bash
# Run a code review with default settings
npx tri review

# Run a code review with specific models and options
npx tri review \
  --models openai,claude,gemini \
  --diff \
  --output triumvirate.json \
  --fail-on-error \
  --summary-only

# Generate a summary from existing raw reports
npx tri summarize --input raw-reports.json --output summary.md

# Decompose a review into tasks with dependencies
npx tri plan --input summary.md --output plan.json

# Get the next available task
npx tri next --input plan.json
```

You can also use the full command name `triumvirate` instead of the shorthand `tri`.

## CLI Workflow

Triumvirate now supports a complete code review workflow through its subcommands:

1. **`report`**: Run code reviews across multiple LLM providers and generate raw reports
2. **`summarize`**: Generate a summary from existing raw reports
3. **`plan`**: Decompose the review into a set of tasks with dependencies
4. **`next`**: Identify and display the next available task to work on

## Advanced CLI Options

Triumvirate integrates [Repomix](https://github.com/yamadashy/repomix) for codebase packaging and provides many configuration options.

### Global Options

```bash
--version, -v        Show version information
--verbose            Enable verbose logging for detailed output
--quiet              Disable all output to stdout
```

### Report Command Options

```bash
--models, -m         Comma-separated model list (openai,claude,gemini)
--ignore, -i         Comma-separated list of patterns to exclude
--diff               Only review files changed in the current git diff
--output, -o         Path to write the review output JSON
--fail-on-error      Exit with non-zero code if any model fails
--summary-only       Only include summary in results
--token-limit        Maximum number of tokens to send to the model
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

### Summarize Command Options

```bash
--input, -i          Input file containing raw reports
--output, -o         Output file for the summary
--enhanced-report    Generate enhanced report with model agreement analysis
```

### Plan Command Options

```bash
--input, -i          Input file containing the summary
--output, -o         Output file for the plan
```

### Next Command Options

```bash
--input, -i          Input file containing the plan
```

## Examples

Review only changed files using OpenAI:

```bash
npx tri review --models openai --diff
```

Perform a security review:

```bash
npx tri review --review-type security --output security-review.json
```

Focus on specific files with compression:

```bash
npx tri review --include "src/**/*.js,src/**/*.ts" --compress
```

Generate a summary from existing reports:

```bash
npx tri summarize --input raw-reports.json --output summary.md
```

Create a task plan from a summary:

```bash
npx tri plan --input summary.md --output plan.json
```

Get the next task to work on:

```bash
npx tri next --input plan.json
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
