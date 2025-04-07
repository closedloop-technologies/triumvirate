# Triumvirate CLI Structure

This document describes the new CLI structure for Triumvirate, which is modeled after the Repomix CLI.

## Overview

The Triumvirate CLI has been restructured to provide a more robust and user-friendly command-line interface. The new structure includes:

- Better error handling with detailed error messages
- Progress reporting with spinners
- Semantic suggestions for typos in command options
- Modular architecture for easier maintenance and extension

## Usage

```bash
# Run a code review with default settings
triumvirate-new

# Run a code review with specific models
triumvirate-new --models openai,claude

# Run a security-focused review
triumvirate-new --review-type security

# Show version information
triumvirate-new --version

# Install CLI completion
triumvirate-new install

# Uninstall CLI completion
triumvirate-new uninstall
```

## Command Options

### Basic Options

- `-v, --version`: Show version information

### Model Options

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

- `--review-type <type>`: Type of review: general, security, performance, architecture, docs
- `--token-limit <number>`: Maximum tokens to send to the model
- `--fail-on-error`: Exit with non-zero code if any model fails

### Token Count Options

- `--token-count-encoding <encoding>`: Specify token count encoding (e.g., o200k_base, cl100k_base)

### Other Options

- `--top-files-len <number>`: Specify the number of top files to display
- `--skip-api-key-validation`: Skip API key validation check
- `--verbose`: Enable verbose logging for detailed output
- `--quiet`: Disable all output to stdout

## Architecture

The new CLI structure is organized as follows:

```text
src/
├── bin/
│   ├── triumvirate.ts        # Original CLI entry point
│   ├── triumvirate-new.ts    # New CLI entry point
│   └── bash-complete.ts      # Bash completion script
├── cli/
│   ├── actions/
│   │   ├── installAction.ts  # Install command implementation
│   │   ├── runAction.ts      # Main command implementation
│   │   ├── uninstallAction.ts # Uninstall command implementation
│   │   └── versionAction.ts  # Version command implementation
│   ├── utils/
│   │   └── spinner.ts        # Progress spinner utility
│   └── cliRun.ts             # CLI setup and command routing
└── utils/
    ├── error.ts             # Error handling utilities
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

## Comparison with Original CLI

The new CLI structure provides several advantages over the original CLI:

1. **Better Error Handling**: More detailed error messages and suggestions for common mistakes
2. **Progress Reporting**: Visual feedback during long-running operations
3. **Semantic Suggestions**: Suggestions for common option variations
4. **Modular Architecture**: Easier maintenance and extension

## Future Improvements

Future improvements to the CLI structure could include:

1. **Configuration Files**: Support for configuration files to store common options
2. **Interactive Mode**: Interactive prompts for common options
3. **Plugin System**: Support for plugins to extend the CLI functionality
