import { Command } from 'commander';

import { runInstallAction } from './actions/installAction.js';
import { runModelsAction } from './actions/modelsAction.js';
import { runNextAction } from './actions/nextAction.js';
import { runPlanAction } from './actions/planAction.js';
import { runCliAction } from './actions/runAction.js';
import { runSummarizeAction } from './actions/summarizeAction.js';
import { runUninstallAction } from './actions/uninstallAction.js';
import { version as packageVersion } from '../../package.json';
// Import consolidated error handling
import { TriumvirateError, ErrorCategory } from '../utils/error-handling.js';
import { logger } from '../utils/logger.js'; // Use the existing logger

// Constants for support links (moved from error.ts)
const TRIUMVIRATE_ISSUES_URL = 'https://github.com/closedloop-technologies/triumvirate/issues';

// Semantic mapping for CLI suggestions
const semanticSuggestionMap: Record<string, string[]> = {
    exclude: ['--ignore'],
    reject: ['--ignore'],
    omit: ['--ignore'],
    skip: ['--ignore'],
    save: ['--output'],
    export: ['--output'],
    out: ['--output'],
    file: ['--output'],
    format: ['--style'],
    type: ['--style'],
    debug: ['--verbose'],
    detailed: ['--verbose'],
    silent: ['--quiet'],
    mute: ['--quiet'],
    add: ['--include'],
    with: ['--include'],
};

// Create the commander program
const program = new Command();

// Centralized CLI Error Handler
function handleCliError(error: unknown): void {
    logger.log(''); // Add a newline for better formatting

    let displayError: TriumvirateError;

    if (error instanceof TriumvirateError) {
        displayError = error;
        logger.error(`❌ ${displayError.getDetailedMessage()}`); // Use detailed message
    } else if (error instanceof Error) {
        // Wrap unexpected errors
        displayError = new TriumvirateError(
            `Unexpected error: ${error.message}`,
            ErrorCategory.UNKNOWN,
            'CLI',
            false,
            error
        );
        logger.error(`❌ ${displayError.message}`);
        // Log stack trace for unexpected errors by default or if verbose
        logger.note('Stack trace:', error.stack);
    } else {
        // Handle non-Error objects thrown
        displayError = new TriumvirateError(
            'An unknown error occurred',
            ErrorCategory.UNKNOWN,
            'CLI',
            false,
            error
        );
        logger.error(`❌ ${displayError.message}`);
    }

    // Log original error stack trace in debug mode
    if (displayError.originalError instanceof Error && displayError.originalError.stack) {
        logger.debug('Original error stack:', displayError.originalError.stack);
    }

    // Provide helpful context based on error category or message
    if (displayError.category === ErrorCategory.AUTHENTICATION) {
        logger.info(
            'Please check your API key configuration (environment variables or .env file).'
        );
        // Consider adding getApiKeySetupInstructions() here if relevant
    } else if (
        displayError.message.includes('command not found') ||
        displayError.message.includes('ENOENT')
    ) {
        logger.info(
            'Ensure required external tools (like git or Node.js) are installed and in your PATH.'
        );
    }

    // Show verbose hint only if not already in debug mode
    if (logger.getLogLevel() < 5) {
        // 5 corresponds to debug level in logger.ts
        logger.log('');
        logger.note('For detailed debug information, use the --verbose flag');
    }

    // Community support information
    logger.log('');
    logger.info('Need help?');
    logger.info(`• File an issue on GitHub: ${TRIUMVIRATE_ISSUES_URL}`);

    // Exit with error code
    process.exit(1);
}

export const run = async () => {
    try {
        program
            .name('triumvirate')
            .description(
                'Triumvirate - Run codebase reviews across OpenAI, Claude, and Gemini models'
            )
            .version(packageVersion, '-v, --version', 'show version information')
            // Add global options to the root command
            .option(
                '--agent-model <model>',
                'Specify the LLM model to use (default: claude)',
                'claude'
            )
            .option(
                '--output-dir <dir>',
                'Specify the output directory (default: ./.triumvirate)',
                './.triumvirate'
            )
            .option(
                '--pass-threshold <threshold>',
                'Set review pass/fail threshold (strict, lenient, none)',
                'lenient'
            )
            .option(
                '--task <description>',
                'Specify a task description for LLM-driven task generation'
            )
            .option('--verbose', 'enable verbose logging for detailed output')
            .option('--quiet', 'disable all output to stdout');

        // Review command (previously the report command)
        const reviewCommand = program
            .command('review')
            .description('Run a code review with default settings and creates the summary')
            .argument('[directories...]', 'list of directories to process', ['.'])
            // Model tier selection options
            .option(
                '--tier <tier>',
                'model tier: cheap, standard, or premium (default: standard)',
                'standard'
            )
            .option('--context <size>', 'context size: 100k, 1m, or auto (default: auto)', 'auto')
            // Triumvirate-specific options (legacy - use --tier instead)
            .option(
                '-m, --models <models>',
                '[DEPRECATED] comma-separated list of models - use --tier instead'
            )
            .option('--task <task>', 'task description to focus the review')
            .option(
                '--doc <path>',
                'documentation file or URL (can be repeated)',
                (value, previous: string[] = []) => {
                    previous.push(value);
                    return previous;
                },
                []
            )
            .option('--fail-on-error', 'exit with non-zero code if any model fails')
            .option('--skip-api-key-validation', 'skip API key validation check')
            .option('--enhanced-report', 'generate enhanced report with model agreement analysis')
            .option('--summary-only', 'only include summary in results')
            .option(
                '--badge [path]',
                'embed a review status badge in README.md (optionally specify path)'
            )

            // Input options
            .option(
                '--input <file>',
                'use pre-existing context file instead of running repomix (use "-" for STDIN)'
            )

            // Repomix-specific options
            .option('--token-limit <number>', 'maximum tokens to send to the model')
            .option(
                '--token-count-encoding <encoding>',
                'specify token count encoding (e.g., o200k_base, cl100k_base)'
            )
            .option('--compress', 'perform code compression to reduce token count')
            .option('--remove-comments', 'remove comments')
            .option('--remove-empty-lines', 'remove empty lines')
            .option('--top-files-len <number>', 'specify the number of top files to display')
            .option('--header-text <text>', 'specify the header text')
            .option(
                '--instruction-file-path <path>',
                'path to a file containing detailed custom instructions'
                // DoD: Implement --docs functionality here or pass down
                // Option: Could reuse --instruction-file-path or add explicit --docs
            )

            // Output options
            .option('--style <type>', 'specify the output style (xml, markdown, plain)')
            .option('--output-show-line-numbers', 'add line numbers to each line in the output')

            // Filter options
            .option('--include <patterns>', 'list of include patterns (comma-separated)')
            .option('-i, --ignore <patterns>', 'additional ignore patterns (comma-separated)')
            .option('--diff', 'only review files changed in git diff')

            // Inherit global options for context
            .option(
                '--agent-model <model>',
                'specify the LLM for report analysis (default: claude)',
                'claude'
            )
            .option(
                '--output-dir <dir>',
                'specify the output directory (default: ./.triumvirate)',
                './.triumvirate'
            )
            .option(
                '--pass-threshold <level>',
                'set review pass/fail threshold (strict, lenient, none)',
                'none'
            )
            .action(runCliAction);

        // Add custom help text for the review command
        reviewCommand.addHelpText(
            'after',
            `
Option Groups:

  Model Selection:
    --tier <tier>                  Model tier: cheap, standard, or premium (default: standard)
    --context <size>               Context size: 100k, 1m, or auto (default: auto)
    -m, --models                   [DEPRECATED] Use --tier instead

  Triumvirate Options:
    --task                         Task description for the review (e.g. security, performance, architecture, docs)
    --doc                          Documentation file or URL (supports multiple)
    --fail-on-error                Exit with error if any model fails
    --skip-api-key-validation      Skip API key validation
    --enhanced-report              Generate enhanced report with model agreement
    --summary-only                 Only include summary in results
    --badge [path]                 Embed review status badge in README.md
    --agent-model                  LLM model for report analysis/planning

  Input Options:
    --input <file>                 Use pre-existing context file instead of repomix (use "-" for STDIN)

  Repomix Options:
    --token-limit                  Maximum tokens to send to the model
    --token-count-encoding         Token count encoding to use
    --compress                     Compress code to reduce token count
    --remove-comments              Remove comments from code
    --remove-empty-lines           Remove empty lines from code
    --top-files-len                Number of top files to display
    --header-text                  Header text for the report
    --instruction-file-path        Path to custom instructions file

  Output Options:
    --output-dir                   Output directory (default: ./.triumvirate)
    --style                        Output style format
    --output-show-line-numbers     Show line numbers in output

  Filter Options:
    --include                      Patterns to include
    -i, --ignore                   Patterns to ignore
    --diff                         Only review files in git diff

  Threshold Options:
    --pass-threshold               Set review pass/fail threshold (strict, lenient, none)

`
        );

        // Summarize command - Just runs the summary from an existing set of raw reports
        program
            .command('summarize')
            .description('Generate a summary from existing raw reports')
            .option('-i, --input <file>', 'Input file containing raw JSON reports')
            .option('-o, --output <file>', 'Output file for the summary (Markdown)')
            .option(
                '--agent-model <model>',
                'Specify the LLM for summary analysis (default: claude)',
                'claude'
            ) // Inherit/Allow override
            .option(
                '--output-dir <dir>',
                'Specify the output directory (default: ./.triumvirate)',
                './.triumvirate'
            ) // Inherit/Allow override
            .option('--enhanced-report', 'generate enhanced report with model agreement analysis')
            .action(runSummarizeAction);

        // Plan command - Decompose the review into a set of tasks with dependencies
        program
            .command('plan')
            .description('Decompose a review summary into a set of tasks with dependencies')
            .option('-i, --input <file>', 'Input Markdown file containing the summary')
            .option('-o, --output <file>', 'Output JSON file for the plan')
            .option(
                '--agent-model <model>',
                'Specify the LLM for planning (default: claude)',
                'claude'
            ) // Inherit/Allow override
            .option(
                '--output-dir <dir>',
                'Specify the output directory (default: ./.triumvirate)',
                './.triumvirate'
            ) // Inherit/Allow override
            .action(runPlanAction);

        // Next command - Emits the next available task
        program
            .command('next')
            .description('Read the plan and emit the next available task')
            .option('-i, --input <file>', 'Input JSON file containing the plan')
            .option(
                '--output-dir <dir>',
                'Specify the output directory (default: ./.triumvirate)',
                './.triumvirate'
            ) // Inherit/Allow override
            .option('--mark-complete <taskId>', 'Mark a specific task as completed')
            .option('--branch', 'Create a git branch for the next task')
            .action(runNextAction);

        // Add install and uninstall commands
        program
            .command('install')
            .description('Install Triumvirate CLI completion')
            .action(runInstallAction);

        program
            .command('uninstall')
            .description('Uninstall Triumvirate CLI completion')
            .action(runUninstallAction);

        // Models command to list available models
        program
            .command('models')
            .description('List all available LLM models with cost information')
            .option(
                '--provider <provider>',
                'Filter models by provider (e.g., openai, anthropic, google)'
            )
            .option('--all', 'Show all models without limiting the display')
            .option('--sort <sort>', 'Sort models by cost or name', /^(cost|name)$/i, 'cost')
            .action(options => runModelsAction(options));

        // Custom error handling with semantic suggestions
        const configOutput = program.configureOutput();
        const originalOutputError = configOutput.outputError || ((str, write) => write(str));

        program.configureOutput({
            outputError: (str, write) => {
                // Check if this is an unknown option error
                if (str.includes('unknown option')) {
                    const match = str.match(/unknown option '?(-{1,2}[^ ']+)'?/i);
                    if (match?.[1]) {
                        const unknownOption = match[1];
                        const cleanOption = unknownOption.replace(/^-+/, '');

                        // Check if the option has a semantic match
                        const semanticMatches = semanticSuggestionMap[cleanOption];
                        if (semanticMatches) {
                            // We have a direct semantic match
                            logger.error(`✖ Unknown option: ${unknownOption}`);
                            logger.info(`Did you mean: ${semanticMatches.join(' or ')}?`);
                            return;
                        }
                    }
                }

                // Fall back to the original Commander error handler
                originalOutputError(str, write);
            },
        });

        await program.parseAsync(process.argv);
    } catch (error) {
        handleCliError(error); // Use the new central CLI error handler
    }
};
