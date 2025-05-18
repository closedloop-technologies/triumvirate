# Triumvirate

<div align="center">
  
![Triumvirate Logo](https://raw.githubusercontent.com/closedloop-technologies/triumvirate/refs/heads/main/assets/triumvirate-banner.png)

[![npm version](https://img.shields.io/npm/v/@justbuild/triumvirate.svg)](https://www.npmjs.com/package/@justbuild/triumvirate)
![Triumvirate](https://img.shields.io/badge/Triumvirate-Passed-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Run code reviews through multiple LLMs with one command**
</div>

Triumvirate is a powerful CLI tool and GitHub Action that analyzes your codebase through multiple AI models (OpenAI, Claude, and Gemini), providing a comprehensive, multi-perspective code review with actionable insights.

## Features

- **Multi-model Analysis** - Compare insights from OpenAI, Claude, and Gemini models
- **Cross-model Consensus** - Identify findings that multiple models agree on
- **Specialized Reviews** - Conduct focused reviews for security, performance, architecture, and documentation
- **Actionable Tasks** - Generate prioritized improvement tasks with dependencies
- **CI/CD Integration** - Use as a GitHub Action in your workflow

<!-- PLACEHOLDER: Add CLI animation showing tool in action -->

## Installation

```bash
# Install globally
npm install -g @justbuild/triumvirate

# Or use directly with npx
npx @justbuild/triumvirate
```

## Quick Start

### Set up API Keys

1. Create a `.env` file in your project root:

```bash
cp .env.example .env
```

2. Add your API keys:

```
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
```

### Basic Usage

```bash
# Run a review using all models
tri review

# Run a review with specific models
tri review --models openai/gpt-4.1,anthropic/claude-3-7-sonnet-20250219

# Run a security-focused review
tri review --review-type security
```

<!-- PLACEHOLDER: Add screenshot of review output -->

## CLI Reference

Triumvirate provides a complete code review workflow:

```
tri <command> [options]
```

### Main Commands

- `review` - Run code reviews across multiple LLM providers
- `summarize` - Generate a summary from existing raw reports
- `plan` - Decompose a review into tasks with dependencies
- `next` - Identify and display the next available task
- `install` - Install CLI completion
- `uninstall` - Uninstall CLI completion

### Review Command Options

```bash
tri review [options]
```

#### Model Options

- `-m, --models <models>` - Comma-separated list of models (default: openai/gpt-4.1,anthropic/claude-3-7-sonnet-20250219,google/gemini-2.5-pro-exp-03-25)
- `--review-type <type>` - Type of review: general, security, performance, architecture, docs
- `--fail-on-error` - Exit with non-zero code if any model fails
- `--skip-api-key-validation` - Skip API key validation check
- `--enhanced-report` - Generate enhanced report with model agreement analysis (default: true)
- `--summary-only` - Only include summary in results

#### Output Options

- `-o, --output <file>` - Specify the output file or directory
- `--style <type>` - Specify the output style (xml, markdown, plain)
- `--output-show-line-numbers` - Add line numbers to each line in the output

#### Filter Options

- `--include <patterns>` - List of include patterns (comma-separated)
- `-i, --ignore <patterns>` - Additional ignore patterns (comma-separated)
- `--diff` - Only review files changed in git diff

#### Processing Options

- `--token-limit <number>` - Maximum tokens to send to the model
- `--token-count-encoding <encoding>` - Specify token count encoding
- `--compress` - Perform code compression to reduce token count
- `--remove-comments` - Remove comments from code
- `--remove-empty-lines` - Remove empty lines from code
- `--top-files-len <number>` - Specify the number of top files to include

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

- `-i, --input <file>` - Input file containing the summary
- `-o, --output <file>` - Output file for the plan

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
tri review --diff --models openai/gpt-4.1
```

### Focus on Specific Files with Compression

```bash
tri review --include "src/**/*.js,src/**/*.ts" --compress
```

### Generate Plan from Existing Summary

```bash
tri plan --input summary.md --output plan.json
```

### Get Next Task

```bash
tri next --input plan.json
```

<!-- PLACEHOLDER: Add screenshot of next task output -->

## GitHub Actions Integration

Add this to your workflow file:

```yaml
name: Triumvirate Review

on:
  pull_request:
    branches: [main]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: |
          export OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
          export ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
          export GOOGLE_API_KEY=${{ secrets.GOOGLE_API_KEY }}
          npx triumvirate --models openai/gpt-4.1,anthropic/claude-3-7-sonnet-20250219,google/gemini-2.5-pro-exp-03-25 --diff --output triumvirate.json --fail-on-error
      - name: Upload Review Output
        uses: actions/upload-artifact@v3
        with:
          name: triumvirate-results
          path: triumvirate.json
```

## Developer Workflow

Triumvirate supports productive development workflows with:

- **Pre-commit Hooks**: Fast checks on changed files only
- **Pre-push Hooks**: Complete verification before pushing
- **Dependency Management**: Best practices for package lock files

## Docker Development Environment

A `Dockerfile` is provided for development and testing. Build the image and open a shell:

```bash
docker build -t triumvirate .
docker run -it --rm triumvirate bash
```

Run tests inside the container:

```bash
docker run --rm triumvirate npm test
```


## Report Output

Triumvirate generates comprehensive reports that include:

- Executive summary with key metrics
- Model performance analysis
- Key strengths and areas for improvement
- Findings by category with code examples
- Model agreement analysis
- Actionable recommendations

<!-- PLACEHOLDER: Add screenshot of report output -->

## Supported Models

Triumvirate works with these cutting-edge models:

- **OpenAI**: GPT-4o (128k context)
- **Anthropic**: Claude 3.7 Sonnet (200k context)
- **Google**: Gemini 2.5 Pro (2M context)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
