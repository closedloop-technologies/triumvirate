# Triumvirate

![Triumvirate Logo](https://raw.githubusercontent.com/closedloop-technologies/triumvirate/refs/heads/main/assets/triumvirate-banner.png)

[![npm version](https://img.shields.io/npm/v/@justbuild/triumvirate.svg)](https://www.npmjs.com/package/@justbuild/triumvirate)
<!-- TODO: Add Build Status Badge -->
![Triumvirate](https://img.shields.io/badge/Triumvirate-Passed-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Run code reviews through multiple LLMs with one command

Triumvirate is a powerful CLI tool and GitHub Action that analyzes your codebase through multiple AI models (OpenAI, Claude, and Gemini), providing a comprehensive, multi-perspective code review with actionable insights. The tool identifies areas of consensus across models, highlighting critical issues that multiple AI systems agree upon.

> **Triumvirate gives vibe-coders, agentic coders, and lean dev teams a whole-repo AI review that LLMs can truly understand—uncovering subtle design flaws, logic slips, and cross-file inconsistencies that slip past linters and traditional static-analysis tools.**

## Features

- **Multi-model Analysis** - Compare insights from OpenAI, Claude, and Gemini models
- **Cross-model Consensus** - Identify findings that multiple models agree on with clear agreement indicators (🚨 high, ❗ partial, ⚠️ low)
- **Specialized Reviews** - Conduct focused reviews for security, performance, architecture, and documentation
- **Actionable Tasks** - Generate prioritized improvement tasks with dependencies
- **CI/CD Integration** - Use as a GitHub Action in your workflow
- **Cost Transparency** - View detailed API usage and cost breakdown for each model
- **Comprehensive Reports** - Get categorized findings with detailed explanations

<!-- PLACEHOLDER: Add CLI animation showing tool in action -->

## Installation

```bash
# Install globally
npm install -g @justbuild/triumvirate@latest

# Or use directly with npx
npx @justbuild/triumvirate

# For development/contributing
git clone https://github.com/closedloop-technologies/triumvirate.git
cd triumvirate
npm install
npm run build
```

After installing globally, you can run the tool using either `tri` or `triumvirate` commands.

## Quick Start

### Set up API Keys

 1. Create a `.env` file in your project root:

    ```bash
    cp .env.example .env
    ```

 1. Add your API keys:

    ```bash
    OPENAI_API_KEY=your-openai-key
    ANTHROPIC_API_KEY=your-anthropic-key
    GOOGLE_API_KEY=your-google-key
    ```

### Basic Usage

```bash
tri review

# Run a review with specific models
tri review --models openai,claude

# Run a security-focused review
tri review --review-type security

# For local development/testing
npm run dev review
```

**Default output location:** Review artifacts (JSON, Markdown) are saved in the `.triumvirate/` directory within your project root, named with a timestamp (e.g., `.triumvirate/tri-review-2024-08-15T103000Z.md`). Use the `-o` option to specify a different file or directory.

**Output format:** The review process provides real-time progress indicators and generates a comprehensive report with:

- Categories of findings (e.g., Code Quality, Error Handling, Security)
- Specific findings with agreement levels across models (🚨 high, ❗ partial, ⚠️ low)
- Distribution of findings by category
- API usage summary with detailed cost breakdown

**Cost information:** The tool provides transparency about API usage costs, showing:

- Total cost across all models
- Token usage (input and output)
- Per-model cost breakdown

<!-- PLACEHOLDER: Add screenshot of review output -->

## CLI Reference

Triumvirate provides a command-line interface for running code reviews.

```bash
tri <command> [options]
```

- `review` – run code reviews across selected models
- `summarize` – create a summary from raw review output
- `plan` – break a summary into tasks with dependencies
- `next` – display the next available task

Run `tri --help` to see all available options.

## GitHub Action

```bash
tri review [options]
```

#### Model Options

- `-m, --models <models>` - Comma-separated list of models (default: openai,claude,gemini)
- `--review-type <type>` - Type of review: general, security, performance, architecture, docs
- `--fail-on-error` - Exit with non-zero code if any model fails
- `--skip-api-key-validation` - Skip API key validation check
- `--enhanced-report` - Generate enhanced report with model agreement analysis (default: true)
- `--summary-only` - Only include summary in results

#### Output & Formatting Options

- `-o, --output <file>` - Specify the output file or directory (defaults to `.triumvirate/`)
- `--style <type>` - Specify the output style (xml, markdown, plain)
- `--output-show-line-numbers` - Add line numbers to each line in the output

#### Filter Options

- `--include <patterns>` - List of include patterns (comma-separated)
- `-i, --ignore <patterns>` - Additional ignore patterns (comma-separated)
- `--diff` - Only review files changed in git diff

#### Task & Context Options

- `--docs <paths...>` - List of documentation file paths to include as context
- `--task <description>` - Specific task or question to guide the review

#### Processing & Review Options

- `--token-limit <number>` - Maximum tokens to send to the model
- `--token-count-encoding <encoding>` - Specify token count encoding
- `--compress` - Perform code compression to reduce token count
- `--remove-comments` - Remove comments from code
- `--remove-empty-lines` - Remove empty lines from code
- `--top-files-len <number>` - Specify the number of top files to include

#### Model & Threshold Options

- `--agent-model <model>` - Specify the LLM for report analysis and planning (default: claude)
- `--output-dir <dir>` - Specify the output directory (default: ./.triumvirate)
- `--pass-threshold <threshold>` - Set review pass/fail threshold (strict, lenient, none)

### Summarize Command Options

```bash
tri summarize [options]
```

- `-i, --input <file>` - Input file containing raw reports
- `-o, --output <file>` - Output file for the summary
- `--enhanced-report` - Generate enhanced report with model agreement analysis

### Plan Command Options

```bash
tri plan [options]
```

- `-i, --input <file>` - Input file containing the summary (if not specified, will use the latest output from `tri review`)
- `-o, --output <file>` - Output file for the plan
- `--agent-model <model>` - Specify the LLM for task generation (default: claude)
- `--task <description>` - Specific task or focus to guide the task generation
- `--output-dir <dir>` - Specify the output directory (default: ./.triumvirate)

### Next Command Options

```bash
tri next [options]
```

- `-i, --input <file>` - Input file containing the plan

### Global Options

- `-v, --version` - Show version information
- `--verbose` - Enable verbose logging for detailed output
- `--quiet` - Disable all output to stdout

## Advanced Examples

### Focused Security Review

```bash
tri review --review-type security --output security-review.json
```

### Only Review Changed Files

```bash
tri review --diff --models openai
```

### Focus on Specific Files with Compression

```bash
tri review --include "src/**/*.js,src/**/*.ts" --compress
```

### Generate Plan from Existing Summary

```bash
# Basic plan generation using the latest review summary
tri plan

# Basic plan generation with explicit input and output files
tri plan --input summary.md --output plan.json

# Generate plan with a specific LLM and task focus
tri plan --agent-model openai --task "Improve error handling and add tests"
```

## Understanding the Output

When running `tri review`, you'll see output similar to this:

```text
📦 Triumvirate v0.4.0

Checking API keys for models: openai, claude, gemini
✅ API key validation passed.

... [processing indicators] ...

┌─────────────────────────────────────────────────────┐
│          █▓▒░  21 FINDINGS EXTRACTED ░▒▓█           │
└─────────────────────────────────────────────────────┘
Key Findings:          08 ✅ | 13 ❌
Improvement Agreement: 03 🚨 | 07 ❗ | 03 ⚠️
🚨 3 findings have high agreement across models
1. Inconsistent Error Handling
2. Lack of Global Configuration System
3. Path Sanitization and Security Risks

... [additional findings] ...

┌─────────────────────────────────────────────────────┐
│             █▓▒░ API USAGE SUMMARY ░▒▓█             │
└─────────────────────────────────────────────────────┘
 Total API Calls:           9  
 Total Cost:           $0.5028          
 Total Tokens:         200568  (183630 input, 16938 output)
```

The findings are categorized by agreement level:

- 🚨 **High Agreement**: Issues identified by all models
- ❗ **Partial Agreement**: Issues identified by multiple but not all models
- ⚠️ **Low Agreement**: Issues identified by only one model

The API usage summary provides transparency about the cost of the review process.

### Get Next Task

```bash
tri next --input plan.json
```

<!-- PLACEHOLDER: Add screenshot of next task output -->

## GitHub Actions Integration

Add this step to your CI workflow (e.g., in `.github/workflows/ci.yml`):

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
    # Run on changed files, fail if any model errors, set pass threshold
    npx triumvirate review --models openai,claude,gemini \
      --diff \
      --output-dir .triumvirate \
      --fail-on-error \
      --pass-threshold lenient \
      --agent-model claude

- name: Upload Review Output
  uses: actions/upload-artifact@v3
  with:
    name: triumvirate-results
    path: .triumvirate/triumvirate-review.json
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and improvements.

## License

MIT
