# Triumvirate CLI Structure

This document describes the CLI structure for Triumvirate, which provides a robust and user-friendly command-line interface for running code reviews across multiple LLM providers.

## Overview

The Triumvirate CLI has been structured to provide a consistent and intuitive command-line experience. The structure includes:

- Organized subcommands for different operations (`report`, `summarize`, `plan`, `next`)
- Better error handling with detailed error messages
- Progress reporting with spinners
- Semantic suggestions for typos in command options
- Modular architecture for easier maintenance and extension

## Usage

```bash
# Main command and alias
triumvirate
tri

# Show version information
tri --version

# Get help
tri --help
```

### Subcommands

```bash
# Run a code review with default settings and create the summary
tri review

# Run a code review with specific models
tri review --models openai,claude

# Run a security-focused review
tri review --task security

# Just run the summary from an existing set of raw reports
tri summarize --input raw-reports.json --output summary.md

# Given a summary, decompose the review into a set of tasks with dependencies
tri plan --input summary.md --output plan.json

# Read the plan and emit the next available task
tri next --input plan.json

# Install CLI completion
tri install

# Uninstall CLI completion
tri uninstall
```

## Command Options

### Global Options

- `-v, --version`: Show version information
- `--verbose`: Enable verbose logging for detailed output
- `--quiet`: Disable all output to stdout

### Report Command Options

#### Model Options

- `-m, --models <models>`: Comma-separated list of models (default: openai,claude,gemini)

### Output Options

- `-o, --output <file>`: Specify the output file name
- `--style <type>`: Specify the output style (xml, markdown, plain)
- `--compress`: Perform code compression to reduce token count
- `--output-show-line-numbers`: Add line numbers to each line in the output
- `--summary-only`: Only include summary in results
- `--enhanced-report`: Generate enhanced report with model agreement analysis
- `--remove-comments`: Remove comments
- `--remove-empty-lines`: Remove empty lines
- `--header-text <text>`: Specify the header text
- `--instruction-file-path <path>`: Path to a file containing detailed custom instructions

### Filter Options

- `--include <patterns>`: List of include patterns (comma-separated)
- `-i, --ignore <patterns>`: Additional ignore patterns (comma-separated)
- `--diff`: Only review files changed in git diff

### Review Options

- `--review-type <type>`: **Deprecated**. Use `--task` instead. Suggested types: general, security, performance, architecture, docs
- `--task <task>`: Task description to customize the system prompt (e.g. security, performance, architecture, docs)
- `--doc <path>`: Documentation file or URL (can be repeated)
- `--token-limit <number>`: Maximum tokens to send to the model
- `--fail-on-error`: Exit with non-zero code if any model fails

### Token Count Options

- `--token-count-encoding <encoding>`: Specify token count encoding (e.g., o200k_base, cl100k_base)

### Other Report Options

- `--top-files-len <number>`: Specify the number of top files to display
- `--skip-api-key-validation`: Skip API key validation check

### Summarize Command Options

- `-i, --input <file>`: Input file containing raw reports
- `-o, --output <file>`: Output file for the summary
- `--enhanced-report`: Generate enhanced report with model agreement analysis

### Plan Command Options

- `-i, --input <file>`: Input file containing the summary
- `-o, --output <file>`: Output file for the plan

### Next Command Options

- `-i, --input <file>`: Input file containing the plan

## Architecture

The CLI structure is organized as follows:

```text
src/
├── bin/
│   ├── triumvirate.ts    # CLI entry point
│   └── bash-complete.ts      # Bash completion script
├── cli/
│   ├── actions/
│   │   ├── installAction.ts  # Install command implementation
│   │   ├── runAction.ts      # Report command implementation
│   │   ├── summarizeAction.ts # Summarize command implementation
│   │   ├── planAction.ts     # Plan command implementation
│   │   ├── nextAction.ts     # Next command implementation
│   │   ├── uninstallAction.ts # Uninstall command implementation
│   │   └── versionAction.ts  # Version command implementation
│   ├── utils/
│   │   └── spinner.ts        # Progress spinner utility
│   └── cliRun.ts             # CLI setup and command routing
└── utils/
    ├── error.ts             # Error handling utilities
    ├── error-handling.ts    # Enhanced error handling utilities
    ├── report-utils.ts      # Report generation utilities
    └── logger.ts            # Logging utilities
```

## Error Handling

The new CLI structure includes improved error handling with detailed error messages and suggestions for common mistakes. For example, if you mistype an option, the CLI will suggest the correct option:

```text
✖ Unknown option: --exclude
Did you mean: --ignore?
```

## Progress Reporting

The CLI now includes progress reporting with spinners to provide visual feedback during long-running operations:

```text
⠋ Preparing codebase for review...
⠙ Running code review across models...
✔ Code review completed successfully!
```

## Semantic Suggestions

The CLI includes semantic suggestions for common option variations. For example, if you use `--exclude` instead of `--ignore`, the CLI will suggest the correct option.

## Command Workflow

The Triumvirate CLI is designed to support a complete code review workflow:

1. **Report**: Run code reviews across multiple LLM providers and generate raw reports
2. **Summarize**: Generate a summary from existing raw reports
3. **Plan**: Decompose the review into a set of tasks with dependencies
4. **Next**: Identify and display the next available task to work on

This workflow allows for a more structured approach to code reviews, enabling teams to:

- Run comprehensive code reviews
- Generate actionable summaries
- Create task plans with dependencies
- Track and prioritize code improvement tasks

## Future Improvements

Future improvements to the CLI structure could include:

1. **Configuration Files**: Support for configuration files to store common options
2. **Interactive Mode**: Interactive prompts for common options
3. **Plugin System**: Support for plugins to extend the CLI functionality
4. **Task Tracking**: Integration with issue tracking systems
5. **Continuous Integration**: Better integration with CI/CD pipelines
